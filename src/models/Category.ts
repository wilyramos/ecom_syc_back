import mongoose, { Schema, Document, Types } from 'mongoose';

// Atributos posibles para productos de esta categoría
export interface ICategoryAttribute {
    name: string;        // Ej: "Color", "Talla", "Material"
    values: string[];    // Ej: ["Rojo", "Verde"] o ["S", "M", "L"]
    isVariant?: boolean; // This indicates if the attribute is used for product variants
}

export interface ICategory extends Document {
    nombre: string;
    descripcion?: string;
    slug?: string;
    parent?: Types.ObjectId; // Subcategoría (si aplica)
    image?: string;          // Banner o icono de la categoría
    isActive?: boolean;      // Control de visibilidad / soft delete
    attributes?: ICategoryAttribute[]; // Atributos que serviran para los productos ademas de almacenar los filtros en la categoria
    createdAt?: Date;
    updatedAt?: Date;
}

// Subschema para atributos
const categoryAttributeSchema = new Schema<ICategoryAttribute>(
    {
        name: { type: String, required: true, trim: true },
        values: [{ type: String, required: true, trim: true }],
        isVariant: { type: Boolean, default: false },
    },
    { _id: false }
);

// Esquema principal de categoría
const categorySchema = new Schema<ICategory>(
    {
        nombre: { type: String, required: true, unique: true, trim: true },
        descripcion: { type: String, trim: true },
        slug: { type: String, unique: true, trim: true },

        parent: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
            default: null, // null si es categoría raíz
        },

        image: { type: String, trim: true },        // Nueva propiedad
        isActive: { type: Boolean, default: true }, // Control de visibilidad

        attributes: [categoryAttributeSchema], // Atributos informativos
    },
    { timestamps: true }
);

const Category = mongoose.model<ICategory>('Category', categorySchema);
export default Category;
