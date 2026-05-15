import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';
import { PaymentStatus } from './Order';
import { Counter } from './Counter';
import { ICashShift } from '../modules/cash/cash.model';

/**
 * ENUMS DE ESTADO Y PAGO
 */
export enum SaleStatus {
    QUOTE = 'QUOTE',
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
    REFUNDED = 'REFUNDED',
    CANCELED = 'CANCELED',
}

export enum PaymentMethod {
    CASH = 'CASH',
    CARD = 'CARD',
    YAPE = 'YAPE',
    PLIN = 'PLIN',
    TRANSFER = 'TRANSFER',
}

/**
 * INTERFACES SECUNDARIAS
 */
interface ISaleItem {
    product: Types.ObjectId | IProduct;
    variantId?: Types.ObjectId;
    quantity: number;
    price: number;      // Precio unitario al momento de venta
    discount: number;   // Descuento específico por este ítem
    cost: number;       // Costo unitario (para reportes de utilidad)
}

interface ISaleCustomerSnapshot {
    nombre?: string;
    tipoDocumento?: 'DNI' | 'RUC' | 'CE';
    numeroDocumento?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
}

interface ISaleStatusHistory {
    status: SaleStatus;
    changedAt: Date;
}

/**
 * INTERFACE PRINCIPAL DE VENTA
 */
export interface ISale extends Document {
    customer?: Types.ObjectId | IUser;
    customerSnapshot?: ISaleCustomerSnapshot;
    employee?: Types.ObjectId | IUser;
    cashShiftId: Types.ObjectId | ICashShift;

    items: ISaleItem[];

    // Matemática de la Venta
    subtotal: number;              // Suma de (price * qty) - item discounts
    totalDiscountAmount: number;   // Descuento global adicional
    totalSurchargeAmount: number;  // Recargos (ej: +5% comisión tarjeta)
    totalPrice: number;            // Precio final neto a cobrar

    receiptType: 'TICKET' | 'BOLETA' | 'FACTURA';
    receiptNumber?: string;

    status: SaleStatus;
    statusHistory: ISaleStatusHistory[];

    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentId?: string;

    storeLocation?: string;
    deliveryMethod: 'PICKUP' | 'DELIVERY';

    // q
    isQuote: boolean;              // Flag rápido
    quoteExpirationDate?: Date;    // Validez de la proforma

    createdAt: Date;
    updatedAt: Date;
}

/**
 * SCHEMAS HIJOS
 */
const saleItemSchema = new Schema<ISaleItem>({
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    cost: { type: Number, default: 0, min: 0 },
}, { _id: false });

const customerSnapshotSchema = new Schema<ISaleCustomerSnapshot>({
    nombre: String,
    tipoDocumento: { type: String, enum: ['DNI', 'RUC', 'CE'] },
    numeroDocumento: String,
    telefono: String,
    email: String,
    direccion: String,
}, { _id: false });

/**
 * SCHEMA PRINCIPAL
 */
const saleSchema = new Schema<ISale>({
    customer: { type: Schema.Types.ObjectId, ref: 'User' },
    customerSnapshot: { type: customerSnapshotSchema },
    employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cashShiftId: {
        type: Schema.Types.ObjectId,
        ref: 'CashShift',
        required: [true, 'Venta requiere caja abierta']
    },

    items: { type: [saleItemSchema], required: true },

    // Totales y Cálculos
    subtotal: { type: Number, required: true, default: 0 },
    totalDiscountAmount: { type: Number, default: 0 },
    totalSurchargeAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true, default: 0 },

    receiptType: {
        type: String,
        enum: ['TICKET', 'BOLETA', 'FACTURA'],
        default: 'TICKET'
    },
    receiptNumber: { type: String, unique: true },

    status: {
        type: String,
        enum: Object.values(SaleStatus),
        default: SaleStatus.COMPLETED
    },
    statusHistory: [{
        status: { type: String, enum: Object.values(SaleStatus) },
        changedAt: { type: Date, default: Date.now }
    }],

    paymentMethod: {
        type: String,
        enum: Object.values(PaymentMethod),
        default: PaymentMethod.CASH
    },
    paymentStatus: {
        type: String,
        enum: Object.values(PaymentStatus),
        default: PaymentStatus.APPROVED
    },
    paymentId: { type: String },

    storeLocation: { type: String },
    deliveryMethod: {
        type: String,
        enum: ['PICKUP', 'DELIVERY'],
        default: 'PICKUP'
    },
}, {
    timestamps: true
});

/**
 * MIDDLEWARE: CÁLCULO DE TOTALES (PRE-SAVE)
 */
saleSchema.pre<ISale>('save', function (next) {
    // 1. Calcular subtotal basado en ítems (Precio * Cantidad - Descuento del ítem)
    const itemsSubtotal = this.items.reduce((sum, item) => {
        const itemTotal = (item.price * item.quantity) - (item.discount || 0);
        return sum + itemTotal;
    }, 0);

    this.subtotal = Math.max(0, itemsSubtotal);

    // 2. Calcular precio final
    // Formula: (Subtotal Items) - Descuento Global + Recargos
    const finalPrice = this.subtotal - (this.totalDiscountAmount || 0) + (this.totalSurchargeAmount || 0);

    this.totalPrice = Math.max(0, finalPrice);

    // 3. Registrar historia si es nueva
    if (this.isNew) {
        this.statusHistory.push({ status: this.status, changedAt: new Date() });
    }

    next();
});

/**
 * MIDDLEWARE: GENERACIÓN DE CORRELATIVO
 */
/**
 * MIDDLEWARE: GENERACIÓN DE CORRELATIVO (Ventas y Proformas)
 */
saleSchema.pre<ISale>("save", async function (next) {
    // Si ya tiene número o no es nuevo, saltar
    if (!this.isNew || this.receiptNumber) return next();

    try {
        let counterName: string;
        let prefix: string;

        // 1. Determinar el nombre del contador y el prefijo
        if (this.status === SaleStatus.QUOTE) {
            counterName = 'PROFORMA';
            prefix = 'P'; // P de Proforma
        } else {
            counterName = this.receiptType; // TICKET, BOLETA o FACTURA
            prefix = this.receiptType[0];   // T, B o F
        }

        // 2. Incrementar el contador en la colección Counter
        const counter = await Counter.findOneAndUpdate(
            { name: counterName },
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );

        // 3. Formato: P001-00000001, B001-00000001, etc.
        this.receiptNumber = `${prefix}001-${counter.seq.toString().padStart(8, "0")}`;

        next();
    } catch (err: unknown) {
        next(err as any);
    }
});

/**
 * ÍNDICES
 */
saleSchema.index({ cashShiftId: 1 });
saleSchema.index({ customer: 1 });
saleSchema.index({ employee: 1 });
saleSchema.index({ createdAt: -1 });

export const Sale = mongoose.model<ISale>('Sale', saleSchema);