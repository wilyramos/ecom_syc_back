/* File: backend/src/models/Sale.ts */
import mongoose, { Schema, Document, Types } from 'mongoose';
import { Counter } from './Counter';

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

export enum PaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REFUNDED = 'refunded',
}

export enum ReceiptType {
    TICKET = 'TICKET',
    BOLETA = 'BOLETA',
    FACTURA = 'FACTURA',
}

export enum DeliveryMethod {
    PICKUP = 'PICKUP',
    DELIVERY = 'DELIVERY',
}

export enum DocumentType {
    DNI = 'DNI',
    RUC = 'RUC',
    CE = 'CE',
}

export interface ISaleItem {
    product: Types.ObjectId;
    variantId?: string;
    quantity: number;
    price: number;
    discount: number;
    cost: number;
}

export interface ICustomerSnapshot {
    nombre?: string;
    tipoDocumento?: DocumentType;
    numeroDocumento?: string;
    telefono?: string;
    email?: string;
    direccion?: string;
}

export interface IStatusHistory {
    status: SaleStatus;
    changedAt: Date;
}

export interface ISale extends Document {
    customer?: Types.ObjectId | null;
    customerSnapshot?: ICustomerSnapshot;
    employee?: Types.ObjectId | null;
    cashShiftId: Types.ObjectId;
    items: ISaleItem[];
    subtotal: number;
    totalDiscountAmount: number;
    totalSurchargeAmount: number;
    totalPrice: number;
    receiptType: ReceiptType;
    receiptNumber?: string;
    status: SaleStatus;
    statusHistory: IStatusHistory[];
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    paymentId?: string;
    storeLocation?: string;
    deliveryMethod: DeliveryMethod;
    isQuote: boolean;
    quoteExpirationDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
    {
        product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        cost: { type: Number, default: 0, min: 0 },
    },
    { _id: false }
);

const CustomerSnapshotSchema = new Schema<ICustomerSnapshot>(
    {
        nombre: { type: String, default: 'Cliente Varios' },
        tipoDocumento: { type: String, enum: Object.values(DocumentType) },
        numeroDocumento: { type: String },
        telefono: { type: String },
        email: { type: String },
        direccion: { type: String },
    },
    { _id: false }
);

const StatusHistorySchema = new Schema<IStatusHistory>(
    {
        status: { type: String, enum: Object.values(SaleStatus), required: true },
        changedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const saleSchema = new Schema<ISale>(
    {
        customer: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        customerSnapshot: { type: CustomerSnapshotSchema, default: () => ({}) },
        employee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        cashShiftId: { type: Schema.Types.ObjectId, ref: 'CashShift', required: true },
        items: {
            type: [SaleItemSchema],
            required: true,
            validate: [(val: ISaleItem[]) => val.length > 0, 'Debe incluir al menos un producto'],
        },
        subtotal: { type: Number, required: true, min: 0 },
        totalDiscountAmount: { type: Number, default: 0, min: 0 },
        totalSurchargeAmount: { type: Number, default: 0, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        receiptType: { type: String, enum: Object.values(ReceiptType), default: ReceiptType.TICKET },
        receiptNumber: { type: String, index: true },
        status: { type: String, enum: Object.values(SaleStatus), default: SaleStatus.COMPLETED },
        statusHistory: { type: [StatusHistorySchema], default: [] },
        paymentMethod: { type: String, enum: Object.values(PaymentMethod), default: PaymentMethod.CASH },
        paymentStatus: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.APPROVED },
        paymentId: { type: String },
        storeLocation: { type: String, default: 'Principal' },
        deliveryMethod: { type: String, enum: Object.values(DeliveryMethod), default: DeliveryMethod.PICKUP },
        isQuote: { type: Boolean, default: false },
        quoteExpirationDate: { type: Date },
    },
    {
        timestamps: true,
    }
);

saleSchema.pre('save', async function (next) {
    if (this.isNew && this.statusHistory.length === 0) {
        this.statusHistory.push({ status: this.status, changedAt: new Date() });
    }

    const isQuoteDocument = this.isQuote || this.status === SaleStatus.QUOTE;
    const isConvertedSale = !this.isNew && !isQuoteDocument && this.receiptNumber?.startsWith('PROFORMA');

    if ((this.isNew && !this.receiptNumber) || isConvertedSale) {
        try {
            const counterName = isQuoteDocument ? 'quote_sequence' : 'sale_sequence';
            const session = this.$session();

            const counter = await Counter.findOneAndUpdate(
                { name: counterName },
                { $inc: { seq: 1 } },
                { new: true, upsert: true, session }
            );

            const seqNumber = counter.seq;
            if (isQuoteDocument) {
                this.receiptNumber = `PROFORMA${seqNumber.toString().padStart(3, '0')}`;
            } else {
                this.receiptNumber = seqNumber.toString().padStart(6, '0');
            }

            next();
        } catch (error) {
            next(error as mongoose.CallbackError);
        }
    } else {
        next();
    }
});

export const Sale = mongoose.model<ISale>('Sale', saleSchema);