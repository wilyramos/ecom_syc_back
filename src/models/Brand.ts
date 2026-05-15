//File: backend/src/models/Brand.ts

import mongoose, { Schema, Document } from "mongoose";

export interface IBrand extends Document {
    nombre: string;
    slug: string;
    descripcion?: string;
    logo?: string;
    isActive: boolean;
}

export const brandSchema = new Schema<IBrand>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true },
        descripcion: { type: String, trim: true },
        logo: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IBrand>("Brand", brandSchema);