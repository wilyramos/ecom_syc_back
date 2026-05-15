//File: backend/src/models/Product.ts

import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { ICategory } from './Category';
import { IBrand } from './Brand';
import { IProductLine } from './ProductLine';

interface ISpecification {
    key: string;
    value: string;
}

export interface IVariant {
    _id?: Types.ObjectId;
    nombre?: string;
    precio?: number;
    precioComparativo?: number;
    costo?: number;
    stock: number;
    sku?: string;
    barcode?: string;
    imagenes?: string[];
    atributos: Record<string, string>;
}

export interface IProduct extends Document {
    nombre: string;
    slug: string;
    descripcion?: string;
    precio?: number;
    precioComparativo?: number;
    costo?: number;
    imagenes?: string[];
    categoria: mongoose.Types.ObjectId | PopulatedDoc<ICategory>;
    brand?: mongoose.Types.ObjectId | PopulatedDoc<IBrand>;
    line?: mongoose.Types.ObjectId | PopulatedDoc<IProductLine>;
    stock?: number;
    sku?: string;
    barcode?: string;
    isActive: boolean;
    esDestacado?: boolean;
    esNuevo?: boolean;
    atributos?: Record<string, string>;
    especificaciones?: ISpecification[];
    diasEnvio?: number;
    fechaDisponibilidad?: Date; // TODO: falta en el frontend, agregar a forms y validaciones
    variants?: IVariant[];
    isFrontPage?: boolean;
    complementarios?: (mongoose.Types.ObjectId | PopulatedDoc<IProduct>)[]; // Array de referencias a otros productos
    tags?: string[];
    weight?: number;
    dimensions?: {
        length: number;
        width: number;
        height: number;
    };
    metaTitle?: string;
    metaDescription?: string;
    rating: number;
    numReviews: number;
    deletedAt?: Date;
}

// --- Sub-schema de especificación ---
const specificationSchema = new Schema<ISpecification>(
    {
        key: { type: String, required: true, trim: true },
        value: { type: String, required: true, trim: true }
    },
    { _id: false }
);

// --- Sub-schema de variante ---
const variantSchema = new Schema<IVariant>(
    {
        nombre: { type: String },
        precio: { type: Number, min: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0 },
        stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        imagenes: { type: [String], default: [] },

        atributos: {
            type: Map,
            of: String,
            default: {}
        }
    },
    { _id: true }
);

// Añadir SearchIndex for searchs

// --- Schema principal ---
const productSchema = new Schema<IProduct>(
    {
        nombre: { type: String, required: true, trim: true },
        slug: { type: String, trim: true, unique: true, required: true },
        descripcion: { type: String },
        precio: { type: Number, min: 0, default: 0 },
        precioComparativo: { type: Number, min: 0 },
        costo: { type: Number, min: 0, default: 0 },
        imagenes: { type: [String], default: [] },
        categoria: { type: Types.ObjectId, ref: 'Category', required: true },
        brand: {
            type: Types.ObjectId,
            ref: 'Brand',
        },
        line: {
            type: Schema.Types.ObjectId,
            ref: 'ProductLine',
            index: true // Importante para filtrar rápido por línea
        }, stock: { type: Number, min: 0, default: 0 },
        sku: { type: String, trim: true },
        barcode: { type: String, trim: true },
        isActive: { type: Boolean, default: true },
        esDestacado: { type: Boolean, default: false },
        esNuevo: { type: Boolean, default: false },

        atributos: {
            type: Map,
            of: String,
            default: {}
        },

        especificaciones: { type: [specificationSchema], default: [] },

        diasEnvio: { type: Number, min: 0, default: 1 },
        fechaDisponibilidad: { type: Date },

        variants: { type: [variantSchema], default: [] },
        complementarios: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Product'
            }
        ],
        tags: { type: [String], default: [], index: true },
        weight: { type: Number, min: 0 },
        dimensions: {
            length: { type: Number, min: 0 },
            width: { type: Number, min: 0 },
            height: { type: Number, min: 0 }
        },
        metaTitle: { type: String, trim: true, maxlength: 60 },
        metaDescription: { type: String, trim: true, maxlength: 160 },
        rating: { type: Number, min: 0, max: 5, default: 0 },
        numReviews: { type: Number, default: 0, min: 0 },
        deletedAt: { type: Date, default: null }
    },

    { timestamps: true }
);

// Índices útiles
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ categoria: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ barcode: 1 });

export default mongoose.model<IProduct>('Product', productSchema);
