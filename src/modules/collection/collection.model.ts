//File: collection.model.ts

import mongoose, { Schema, Document } from 'mongoose';

export interface ICollection extends Document {
    name: string;
    slug: string;
    description?: string;
    image?: string;
    color?: string;
    icon?: string;
    order: number;
    seoTitle?: string;
    seoDescription?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

const collectionSchema = new Schema<ICollection>(
    {
        name: { type: String, required: true, unique: true, trim: true },
        slug: { type: String, required: true, unique: true, trim: true },
        description: { type: String, trim: true },
        image: { type: String, trim: true },
        color: { type: String, trim: true },
        icon: { type: String, trim: true },
        order: { type: Number, default: 0 },
        seoTitle: { type: String, trim: true },
        seoDescription: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Índice para mejorar búsquedas por orden y estado
collectionSchema.index({ isActive: 1, order: 1 });

const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
export default Collection;