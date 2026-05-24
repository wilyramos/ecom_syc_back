import mongoose, { Schema, Document } from 'mongoose';

export const COLLECTION_TYPES = ['promotion', 'theme', 'editorial', 'seasonal'] as const;
export type CollectionType = typeof COLLECTION_TYPES[number];

export interface ICollection extends Document {
    name: string;
    slug: string;
    type: CollectionType;
    description?: string;
    image?: string;
    bannerImage?: string;
    color?: string;
    icon?: string;
    order: number;
    startsAt?: Date;
    endsAt?: Date;
    badgeLabel?: string;
    badgeColor?: string;
    seoTitle?: string;
    seoDescription?: string;
    isActive: boolean;
    deletedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

const collectionSchema = new Schema<ICollection>(
    {
        name: { type: String, required: true, trim: true },
        slug: { type: String, required: true, trim: true },
        type: {
            type: String,
            required: true,
            enum: COLLECTION_TYPES,
        },
        description: { type: String, trim: true },
        image: { type: String, trim: true },
        bannerImage: { type: String, trim: true },
        color: { type: String, trim: true },
        icon: { type: String, trim: true },
        order: { type: Number, default: 0 },
        startsAt: { type: Date, default: null },
        endsAt: { type: Date, default: null },
        badgeLabel: { type: String, trim: true },
        badgeColor: { type: String, trim: true },
        seoTitle: { type: String, trim: true, maxlength: 60 },
        seoDescription: { type: String, trim: true, maxlength: 160 },
        isActive: { type: Boolean, default: true },
        deletedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// --- ÍNDICES DE UNICIDAD PARCIAL ---
// Permiten reusar slugs/nombres si el registro previo fue marcado como borrado (Soft Delete)
collectionSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });
collectionSchema.index({ name: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } });

// --- ÍNDICES DE RENDIMIENTO ---
// Optimiza listados generales ordenados por prioridad en el frontend / admin
collectionSchema.index({ isActive: 1, deletedAt: 1, type: 1, order: 1 });

// Optimiza la búsqueda de promociones activas vigentes según la hora del servidor
collectionSchema.index({ isActive: 1, deletedAt: 1, type: 1, startsAt: 1, endsAt: 1 });

const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
export default Collection;