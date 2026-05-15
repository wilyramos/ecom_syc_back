import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User';
import { IProduct } from './Product';

// Status 
export enum OrderStatus {
    AWAITING_PAYMENT = 'awaiting_payment',
    PROCESSING = 'processing',
    SHIPPED = 'shipped',
    DELIVERED = 'delivered',
    CANCELED = 'canceled',
    PAID_BUT_OUT_OF_STOCK = 'paid_but_out_of_stock'
}

export enum PaymentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    REFUNDED = 'refunded'
}

// Interfaces
export interface IShippingAddress {
    departamento: string;
    provincia: string;
    distrito: string;
    direccion: string;
    numero?: string;
    pisoDpto?: string;
    referencia?: string;
}

export interface IOrderItem {
    productId: Types.ObjectId | IProduct;
    variantId?: Types.ObjectId;
    variantAttributes?: Record<string, string>;
    quantity: number;
    price: number;
    nombre: string; // nombre histórico producto + variante
    imagen?: string;
}

export interface IPaymentInfo {
    provider: string;
    method?: string;
    transactionId?: string;
    status: PaymentStatus;
    rawResponse?: any;
}

export interface IStatusHistory {
    status: OrderStatus;
    changedAt: Date;
}

export interface IOrder extends Document {
    orderNumber: string;
    user: Types.ObjectId | IUser;
    items: IOrderItem[];
    subtotal: number;
    shippingCost: number;
    totalPrice: number;
    currency: string;
    status: OrderStatus;
    statusHistory: IStatusHistory[];
    shippingAddress: IShippingAddress;
    payment: IPaymentInfo;
    createdAt: Date;
    updatedAt: Date;
}

// Schemas
const shippingAddressSchema = new Schema<IShippingAddress>({
    departamento: { type: String, required: true },
    provincia: { type: String, required: true },
    distrito: { type: String, required: true },
    direccion: { type: String, required: true },
    referencia: { type: String }
}, { _id: false });

const orderItemSchema = new Schema<IOrderItem>({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: Schema.Types.ObjectId },
    variantAttributes: { type: Map, of: String },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    nombre: { type: String, required: true },
    imagen: { type: String }
}, { _id: false });

const paymentSchema = new Schema<IPaymentInfo>({
    provider: { type: String, required: true },
    method: { type: String },
    transactionId: { type: String },
    status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
    rawResponse: { type: Schema.Types.Mixed }
}, { _id: false });

const statusHistorySchema = new Schema<IStatusHistory>({
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    changedAt: { type: Date, default: Date.now }
}, { _id: false });

// Schema principal de la orden
const orderSchema = new Schema<IOrder>({
    orderNumber: { type: String, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    shippingCost: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    currency: { type: String, default: 'PEN' },
    status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.AWAITING_PAYMENT },
    statusHistory: { type: [statusHistorySchema], default: [] },
    shippingAddress: { type: shippingAddressSchema, required: true },
    payment: { type: paymentSchema, required: true }
}, { timestamps: true });

// Índices útiles
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'payment.transactionId': 1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
