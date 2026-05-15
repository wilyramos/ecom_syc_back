// controllers/paymentController.ts
import { Request, Response } from 'express';
import { payment } from '../utils/mercadopago';
import Order, { PaymentStatus, OrderStatus } from '../models/Order';
import Product from '../models/Product';
import mongoose from 'mongoose';
import { OrderEmail } from '../emails/OrderEmailResend';
import type { IUser } from '../models/User';

export class WebhookController {
    // --- MERCADO PAGO ---
    static async handleWebHookMercadoPago(req: Request, res: Response) {
        const session = await mongoose.startSession();

        try {
            const event = req.body;
            if (event.type !== 'payment' || !event.data?.id) {
                res.status(400).json({ message: 'Evento no manejado' });
                return;
            }

            const paymentId = event.data.id;

            let paymentData;
            try {
                paymentData = await payment.get({ id: paymentId });
            } catch (mpError) {
                console.error('❌ Error al obtener el pago desde Mercado Pago:', mpError);
                if (mpError?.status === 404) {
                    res.status(404).json({ message: 'Pago no encontrado en Mercado Pago' });
                    return;
                } else {
                    res.status(500).json({ message: 'Error al obtener información del pago' });
                    return;
                }
            }

            if (!paymentData) {
                res.status(404).json({ message: 'Pago no encontrado' });
                return;
            }

            const { status, external_reference } = paymentData;
            const orderId = external_reference;

            if (!orderId) {
                res.status(400).json({ message: 'order_id no encontrado en metadata' });
                return;
            }

            session.startTransaction();

            const order = await Order.findById(orderId)
                .populate('user')
                .session(session);

            if (!order) {
                await session.abortTransaction();
                res.status(404).json({ message: 'Orden no encontrada' });
                return;
            }

            if (order.payment.status === PaymentStatus.APPROVED) {
                await session.abortTransaction();
                res.status(400).json({ message: 'La orden ya ha sido procesada' });
                return;
            }

            if (status === 'approved') {
                // Descontar stock considerando variantes
                for (const item of order.items) {
                    const product = await Product.findById(item.productId._id).session(session);
                    if (!product) {
                        await session.abortTransaction();
                        res.status(404).json({ message: `Producto no encontrado: ${item.productId._id}` });
                        return;
                    }

                    if (item.variantId) {
                        const variant = product.variants?.find(v => v._id.toString() === item.variantId?.toString());
                        if (!variant) {
                            await session.abortTransaction();
                            res.status(404).json({ message: `Variante no encontrada para el producto: ${product.nombre}` });
                            return;
                        }

                        if (variant.stock < item.quantity) {
                            await session.abortTransaction();
                            res.status(400).json({ message: `Stock insuficiente para la variante ${variant.nombre || ''} del producto ${product.nombre}` });
                            return;
                        }

                        variant.stock -= item.quantity;

                        // Actualizar el stock total del producto
                        product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
                    } else {
                        if (product.stock < item.quantity) {
                            await session.abortTransaction();
                            res.status(400).json({ message: `Stock insuficiente para: ${product.nombre}` });
                            return;
                        }
                        product.stock -= item.quantity;
                    }

                    await product.save({ session });
                }

                order.payment.status = PaymentStatus.APPROVED;
                order.status = OrderStatus.PROCESSING;
                order.payment.transactionId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                const user = order.user as any;
                console.log(`📧Items de la orden:`, order.items);
                if (user?.email) {
                    await OrderEmail.sendOrderConfirmationEmail({
                        email: user.email,
                        name: user.nombre,
                        orderId: order._id.toString(),
                        totalPrice: order.totalPrice,
                        shippingMethod: order.shippingAddress.direccion,
                        items: order.items,
                    });
                }

                console.log(`✅ Pago aprobado y orden procesada: ${orderId}`);
                res.status(200).json({ message: 'Pago aprobado y orden procesada' });
                return;
            }
            else if (status === 'pending') {
                order.payment.status = PaymentStatus.PENDING;
                order.status = OrderStatus.AWAITING_PAYMENT;
                order.payment.transactionId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                console.log(`🕐 Pago pendiente registrado para la orden: ${orderId}`);
                res.status(200).json({ message: 'Pago pendiente registrado' });
                return;

            } else if (status === 'rejected') {
                order.payment.status = PaymentStatus.REJECTED;
                order.status = OrderStatus.CANCELED;
                order.payment.transactionId = paymentId;
                order.statusHistory.push({ status: order.status, changedAt: new Date() });

                await order.save({ session });
                await session.commitTransaction();
                session.endSession();

                console.log(`❌ Pago rechazado para la orden: ${orderId}`);
                res.status(200).json({ message: 'Pago rechazado registrado' });
                return;
            } else {
                await session.abortTransaction();
                session.endSession();
                res.status(400).json({ message: `Estado de pago no manejado: ${status}` });
                return;
            }

        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            console.error('❌ Error en Webhook de Mercado Pago:', error);
            res.status(500).json({ message: 'Error interno del servidor' });
            return;
        }
    }

    // --- IZIPAY ---
    static async handleWebHookIzipay(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const krAnswerRaw = req.body["kr-answer"];
            if (!krAnswerRaw) {
                res.status(400).send("Falta kr-answer");
                return;
            }

            const notification = JSON.parse(krAnswerRaw);
            const orderStatus = notification.orderStatus;
            const orderNumber = notification.orderDetails?.orderId;

            if (!orderNumber) {
                res.status(400).json({ message: "Falta orderId en la notificación" });
                return;
            }

            if (!["PAID", "UNPAID"].includes(orderStatus)) {
                console.log(`ℹ️ Estado ${orderStatus} ignorado`);
                await session.commitTransaction();
                res.status(200).send("Estado no relevante");
                return;
            }

            const order = await Order.findById(orderNumber)
                .populate<{ user: IUser }>("user", "email nombre")
                .session(session);

            if (!order) {
                res.status(404).json({ message: "Orden no encontrada" });
                return;
            }

            if (order.payment.status === PaymentStatus.APPROVED) {
                console.log(`⚠️ Orden ${orderNumber} ya procesada, ignorando...`);
                await session.commitTransaction();
                res.status(200).send("Ya procesada");
                return;
            }

            if (orderStatus === "PAID") {
                order.payment.status = PaymentStatus.APPROVED;
                order.payment.transactionId = notification.transactions?.[0]?.uuid || null;
                order.payment.rawResponse = notification;

                try {
                    for (const item of order.items) {
                        const product = await Product.findById(item.productId).session(session);
                        if (!product) throw new Error(`Producto no encontrado: ${item.productId}`);

                        if (item.variantId) {
                            const variant = product.variants?.find(v => v._id.toString() === item.variantId?.toString());
                            if (!variant)
                                throw new Error(`Variante no encontrada para el producto ${product.nombre}`);
                            if (variant.stock < item.quantity)
                                throw new Error(`Stock insuficiente para la variante ${variant.nombre || ''} de ${product.nombre}`);

                            variant.stock -= item.quantity;

                            // Actualizar stock total
                            product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
                        } else {
                            if (product.stock < item.quantity)
                                throw new Error(`Stock insuficiente para ${product.nombre}`);
                            product.stock -= item.quantity;
                        }

                        await product.save({ session });
                    }

                    order.status = OrderStatus.PROCESSING;
                    order.statusHistory.push({
                        status: OrderStatus.PROCESSING,
                        changedAt: new Date()
                    });

                } catch (stockError) {
                    console.error("⚠️ Error de stock:", stockError);
                    order.status = OrderStatus.PAID_BUT_OUT_OF_STOCK;
                    order.statusHistory.push({
                        status: OrderStatus.PAID_BUT_OUT_OF_STOCK,
                        changedAt: new Date()
                    });
                }

                console.log(`✅ Los items de la orden son:`, order.items);
                OrderEmail.sendOrderConfirmationEmail({
                    email: order.user.email || notification.customer?.email,
                    name: order.user.nombre || notification.customer?.name,
                    orderId: order.id,
                    totalPrice: order.totalPrice,
                    shippingMethod: order.payment.method || "Izipay",
                    items: order.items
                });

            } else if (orderStatus === "UNPAID") {
                order.payment.status = PaymentStatus.REJECTED;
                order.status = OrderStatus.CANCELED;
                order.statusHistory.push({
                    status: OrderStatus.CANCELED,
                    changedAt: new Date()
                });
            }

            await order.save({ session });
            await session.commitTransaction();

            res.status(200).send("OK");
            return;

        } catch (error) {
            await session.abortTransaction();
            console.error("❌ Error en Webhook Izipay:", error);
            res.status(500).send("Error interno");
            return;
        } finally {
            session.endSession();
        }
    }
}
