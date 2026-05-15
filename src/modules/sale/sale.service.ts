import mongoose, { Types } from 'mongoose';
import { Sale, ISale, SaleStatus, PaymentMethod } from '../../models/Sale';
import Product from '../../models/Product';
import { CashShift } from '../cash/cash.model';

export class SaleService {
    /**
     * CREAR VENTA REAL
     * Procesa stock, valida caja y aumenta balance de efectivo.
     */
    async createSale(saleData: Partial<ISale>) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Obtener caja activa obligatoria
            const activeShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
            if (!activeShift) throw new Error("No hay una caja abierta para registrar la venta.");

            // 2. Asignar datos automáticos
            saleData.status = SaleStatus.COMPLETED;
            saleData.cashShiftId = activeShift._id as Types.ObjectId;
            if (!saleData.employee) saleData.employee = activeShift.openedBy as any;

            // 3. Validar y Descontar Stock
            await this._processStock(saleData.items || [], session);

            // 4. Guardar Venta (Ejecuta middlewares de totales y correlativos)
            const newSale = new Sale(saleData);
            await newSale.save({ session });

            // 5. Actualizar Balance de Caja (Solo si es CASH)
            if (newSale.paymentMethod === PaymentMethod.CASH) {
                activeShift.totalSalesCash += newSale.totalPrice;
                activeShift.expectedBalance += newSale.totalPrice;
                await activeShift.save({ session });
            }

            await session.commitTransaction();
            return newSale;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * CREAR PROFORMA (QUOTE)
     * No descuenta stock, no genera número de boleta, no afecta caja.
     */
    async createQuote(saleData: Partial<ISale>) {
        const activeShift = await CashShift.findOne({ status: 'OPEN' });
        if (!activeShift) throw new Error("Se requiere una caja activa incluso para proformas.");

        saleData.status = SaleStatus.QUOTE;
        saleData.isQuote = true;
        saleData.cashShiftId = activeShift._id as Types.ObjectId;
        // Validez por defecto: 7 días
        saleData.quoteExpirationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        const quote = new Sale(saleData);
        return await quote.save();
    }

    /**
     * BOTÓN MÁGICO: CONVERTIR PROFORMA A VENTA
     * Valida stock actual y genera el comprobante legal.
     */
    async convertQuoteToSale(quoteId: string, employeeId: string, paymentMethod?: PaymentMethod) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const quote = await Sale.findById(quoteId).session(session);
            if (!quote || quote.status !== SaleStatus.QUOTE) {
                throw new Error("La proforma no existe o ya ha sido procesada.");
            }

            const activeShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
            if (!activeShift) throw new Error("Debe abrir caja para convertir esta proforma en venta.");

            // 1. Validar y Descontar Stock (Crucial: el stock pudo agotarse desde que se hizo la proforma)
            await this._processStock(quote.items, session);

            // 2. Actualizar estado de Proforma a Venta Real
            quote.status = SaleStatus.COMPLETED;
            quote.isQuote = false;
            quote.employee = employeeId as any;
            if (paymentMethod) quote.paymentMethod = paymentMethod;

            // Al guardar, el middleware generará el 'receiptNumber' porque ya no es QUOTE
            await quote.save({ session });

            // 3. Actualizar Caja si el pago final es efectivo
            if (quote.paymentMethod === PaymentMethod.CASH) {
                activeShift.totalSalesCash += quote.totalPrice;
                activeShift.expectedBalance += quote.totalPrice;
                await activeShift.save({ session });
            }

            await session.commitTransaction();
            return quote;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * LÓGICA PRIVADA DE STOCK
     * Maneja productos simples y variantes.
     */
    private async _processStock(items: any[], session: mongoose.ClientSession) {
        for (const item of items) {
            if (item.variantId) {
                // Descontar de Variante
                const product = await Product.findOneAndUpdate(
                    {
                        _id: item.product,
                        "variants._id": item.variantId,
                        "variants.stock": { $gte: item.quantity }
                    },
                    { $inc: { "variants.$.stock": -item.quantity } },
                    { session, new: true }
                );
                if (!product) throw new Error(`Stock insuficiente para variante de: ${item.product}`);
            } else {
                // Descontar de Producto Simple
                const product = await Product.findOneAndUpdate(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } },
                    { session, new: true }
                );
                if (!product) throw new Error(`Stock insuficiente para el producto: ${item.product}`);
            }
        }
    }

    /**
     * QUERIES DE HISTORIAL
     */
    async getSaleHistory(filters: {
        page?: number;
        limit?: number;
        search?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
        cashShiftId?: string;
    }) {
        const {
            page = 1,
            limit = 10,
            search,
            startDate,
            endDate,
            status,
            cashShiftId
        } = filters;

        const skip = (page - 1) * limit;

        // Filtro base: Excluir proformas del historial de ventas real
        const query: any = { status: { $ne: SaleStatus.QUOTE } };

        // Filtro por búsqueda global (Número, Cliente o Documento)
        if (search) {
            query.$or = [
                { receiptNumber: { $regex: search, $options: 'i' } },
                { "customerSnapshot.nombre": { $regex: search, $options: 'i' } },
                { "customerSnapshot.numeroDocumento": { $regex: search, $options: 'i' } }
            ];
        }

        // Filtro por Rango de Fechas
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        // Filtro por Estado (COMPLETED, REFUNDED, etc.)
        if (status) query.status = status;

        // Filtro por Turno de Caja (Útil para ver ventas de un arqueo específico)
        if (cashShiftId) query.cashShiftId = new Types.ObjectId(cashShiftId);

        const [sales, total] = await Promise.all([
            Sale.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('employee', 'nombre')
                .populate('customer', 'nombre'),
            Sale.countDocuments(query)
        ]);

        return {
            sales,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        };
    }

    async getQuotes() {
        return await Sale.find({ status: SaleStatus.QUOTE })
            .sort({ createdAt: -1 })
            .populate('employee', 'nombre');
    }

    async getSaleById(id: string) {
        return await Sale.findById(id)
            .populate('employee', 'nombre')
            .populate('items.product', 'nombre imagenes');
    }

    /**
     * ANULAR / DEVOLVER VENTA COMPLETA
     * Restablece stock, resta de caja y cambia estado.
     */
    async refundSale(saleId: string, reason: string) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const sale = await Sale.findById(saleId).session(session);
            if (!sale) throw new Error("Venta no encontrada.");
            if (sale.status === SaleStatus.REFUNDED || sale.status === SaleStatus.CANCELED) {
                throw new Error("Esta venta ya ha sido anulada o devuelta.");
            }

            await this._reverseStock(sale.items, session);

            if (sale.paymentMethod === PaymentMethod.CASH) {
                const activeShift = await CashShift.findById(sale.cashShiftId).session(session);

                if (activeShift && activeShift.status === 'OPEN') {
                    activeShift.totalSalesCash -= sale.totalPrice;
                    activeShift.expectedBalance -= sale.totalPrice;
                    await activeShift.save({ session });
                } else {
                    // Esto es para auditoría: "Salió dinero hoy por una devolución de ayer"
                    const currentOpenShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
                    if (currentOpenShift) {
                        currentOpenShift.expectedBalance -= sale.totalPrice;
                        // Opcional: Registrar un 'movement' automático de tipo 'OUT'
                        await currentOpenShift.save({ session });
                    }
                }
            }

            // 3. ACTUALIZAR ESTADO DE LA VENTA
            sale.status = SaleStatus.REFUNDED;
            sale.statusHistory.push({ status: SaleStatus.REFUNDED, changedAt: new Date() });
            // Guardamos el motivo en un campo de notas si lo tienes, o en el historial
            await sale.save({ session });

            await session.commitTransaction();
            return sale;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * LÓGICA PRIVADA: REVERSAR STOCK
     */
    private async _reverseStock(items: any[], session: mongoose.ClientSession) {
        for (const item of items) {
            if (item.variantId) {
                // Devolver a Variante
                await Product.findOneAndUpdate(
                    { _id: item.product, "variants._id": item.variantId },
                    { $inc: { "variants.$.stock": item.quantity } },
                    { session }
                );
            } else {
                // Devolver a Producto Simple
                await Product.findOneAndUpdate(
                    { _id: item.product },
                    { $inc: { stock: item.quantity } },
                    { session }
                );
            }
        }
    }
}
