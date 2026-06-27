import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategoryAttribute {
    name: string;
    values: string[];
    isVariant?: boolean;
}

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    parent?: Types.ObjectId;
    image?: string;
    isActive?: boolean;
    deletedAt?: Date;
    order?: number;
    attributes?: ICategoryAttribute[];
    createdAt?: Date;
    updatedAt?: Date;
}

const categoryAttributeSchema = new Schema<ICategoryAttribute>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        values: [{
            type: String,
            required: true,
            trim: true,
            lowercase: true
        }],
        isVariant: {
            type: Boolean,
            default: false
        },
    },
    { _id: false }
);

const categorySchema = new Schema<ICategory>(
    {
        nombre: {
            type: String,
            required: true,
            trim: true,
            // Removemos unique: true aquí, lo haremos con índice
        },
        descripcion: {
            type: String,
            trim: true
        },
        slug: {
            type: String,
            trim: true,
            // Removemos unique: true aquí también
        },
        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null,
        },
        image: {
            type: String,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true
        },
        order: {
            type: Number,
            default: 0
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true  // ← Importante para filtrar rápido
        },
        attributes: [categoryAttributeSchema],
    },
    { timestamps: true }
);

categorySchema.index(
    { nombre: 1, deletedAt: 1 },
    { sparse: true, unique: true }
);
categorySchema.index(
    { slug: 1, deletedAt: 1 },
    { sparse: true, unique: true }
);

// Queries frecuentes
categorySchema.index({ parent: 1, deletedAt: 1 });
categorySchema.index({ isActive: 1, deletedAt: 1 });
categorySchema.index({ 'attributes.name': 1 });
categorySchema.index({ order: 1, createdAt: -1 });

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;