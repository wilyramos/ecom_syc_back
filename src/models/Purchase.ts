import mongoose, { Schema, Document, Types, PopulatedDoc } from "mongoose";
import { IProduct } from "./Product";
import { Counter } from "./Counter";

export interface IPurchaseItem {
    productId: Types.ObjectId | PopulatedDoc<IProduct>;
    quantity: number;
    priceUnit: number;
    totalPrice: number; // quantity * priceUnit
}

export interface IPurchase extends Document {
    numeroCompra: number;   // correlativo automático
    proveedor?: string;
    items: IPurchaseItem[];
    total: number;
}

const purchaseItemSchema = new Schema<IPurchaseItem>({
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceUnit: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const purchaseSchema = new Schema<IPurchase>(
    {
        numeroCompra: { type: Number, unique: true },
        proveedor: { type: String, required: true, trim: true },
        items: { type: [purchaseItemSchema], required: true },
        total: { type: Number, required: true, min: 0 },
    },
    { timestamps: true }
);

// Hook: generar número de compra automático
purchaseSchema.pre("save", async function (next) {
    if (this.isNew) {
        const counter = await Counter.findOneAndUpdate(
            { name: "PURCHASE" }, // clave única para compras
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.numeroCompra = counter.seq;
    }
    next();
});

export const Purchase = mongoose.model<IPurchase>("Purchase", purchaseSchema);
