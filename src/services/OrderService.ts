import mongoose from 'mongoose';
import Order, { OrderStatus } from '../models/Order';
import Product from '../models/Product';

export class OrderService {
    /**
     * Ajusta el stock de múltiples productos de forma atómica
     */
    static async adjustStock(items: any[], action: 'deduct' | 'restore', session: mongoose.ClientSession) {
        for (const item of items) {
            const factor = action === 'deduct' ? -1 : 1;
            const quantity = item.quantity * factor;

            if (item.variantId) {
                // Actualiza variante y stock total del producto simultáneamente
                await Product.updateOne(
                    { _id: item.productId, "variants._id": item.variantId },
                    {
                        $inc: {
                            "variants.$.stock": quantity,
                            "stock": quantity
                        }
                    },
                    { session }
                );
            } else {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { stock: quantity } },
                    { session }
                );
            }
        }
    }

    /**
     * Lógica para procesar la aprobación de una orden
     */
    static async approveOrder(orderId: string, transactionId: string, session: mongoose.ClientSession) {
        const order = await Order.findById(orderId).session(session);
        if (!order) throw new Error('Orden no encontrada');
        if (order.status === OrderStatus.PROCESSING) return order;

        // Descontar stock usando el helper interno
        await this.adjustStock(order.items, 'deduct', session);

        order.status = OrderStatus.PROCESSING;
        order.payment.status = 'approved' as any;
        order.payment.transactionId = transactionId;
        order.statusHistory.push({ status: OrderStatus.PROCESSING, changedAt: new Date() });

        return await order.save({ session });
    }
}