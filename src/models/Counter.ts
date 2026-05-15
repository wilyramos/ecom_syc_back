// models/Counter.ts
import mongoose, { Schema, Document } from "mongoose";

interface ICounter extends Document {
    name: string; // Ejemplo: "BOLETA", "FACTURA", "TICKET"
    seq: number;
}

const counterSchema = new Schema<ICounter>({
    name: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>("Counter", counterSchema);