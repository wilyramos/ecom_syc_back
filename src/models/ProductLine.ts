// File: backend/src/models/ProductLine.ts

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProductLine extends Document {
    nombre: string;
    slug: string;
    descripcion?: string;
    image?: string;
    brand: Types.ObjectId;
    category?: Types.ObjectId;
    descriptionSEO?: string;
    h1Title?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const productLineSchema = new Schema<IProductLine>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
        descripcion: { type: String, trim: true },
        image: { type: String, trim: true },

        brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
        category: { type: Schema.Types.ObjectId, ref: 'Category', index: true },

        descriptionSEO: { type: String, trim: true },
        h1Title: { type: String, trim: true },

        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        collection: 'lines'
    }
);

productLineSchema.index({ brand: 1, slug: 1 });

// Exportamos el modelo como 'ProductLine' (para usarlo en refs)
export default mongoose.model<IProductLine>('ProductLine', productLineSchema);