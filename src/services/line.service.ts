import ProductLine, { IProductLine } from '../models/ProductLine';
import Product from '../models/Product';
import { AppError } from '../utils/AppError';
import { Types } from 'mongoose';
import slugify from 'slugify';

export class LineService {
    
    /**
     * Crea una línea nueva.
     * Genera SLUG automático si no viene en la data.
     */
    static async create(data: Partial<IProductLine>) {
        // 1. Generación Automática de Slug
        if (!data.slug && data.nombre) {
            data.slug = slugify(data.nombre);
        }

        // Validación de seguridad por si mandan nombre vacío
        if (!data.slug) {
            throw new AppError('El nombre es requerido para generar el slug.', 400);
        }

        // 2. Verificar duplicados
        const exists = await ProductLine.findOne({ slug: data.slug });
        if (exists) {
            throw new AppError(`El slug '${data.slug}' ya está en uso.`, 400);
        }

        // 3. Guardar (Mongoose convierte strings de IDs a ObjectIds automáticamente)
        const line = new ProductLine(data);
        return await line.save();
    }

    /**
     * Obtiene líneas con filtros
     */
    static async getAll(limit: number = 100, isActive?: boolean, brandId?: string) {
        const query: any = {};
        
        if (isActive !== undefined) query.isActive = isActive;
        if (brandId) query.brand = brandId;

        return await ProductLine.find(query)
            .populate('brand', 'nombre slug logo')   // Vital para mostrar logo de marca
            .populate('category', 'nombre slug')     // Vital para breadcrumbs
            .limit(limit)
            .sort({ nombre: 1 });
    }

    /**
     * Obtiene por Slug (Para SEO)
     */
    static async getBySlug(slug: string) {
        const line = await ProductLine.findOne({ slug, isActive: true })
            .populate('brand', 'nombre slug logo')
            .populate('category', 'nombre slug');

        if (!line) {
            throw new AppError('Línea de producto no encontrada', 404);
        }

        return line;
    }

    /**
     * Obtiene por Marca (Para Admin o Filtros)
     */
    static async getByBrand(brandId: string) {
        if (!Types.ObjectId.isValid(brandId)) {
            throw new AppError('ID de marca inválido', 400);
        }

        return await ProductLine.find({ brand: brandId, isActive: true })
            .populate('category', 'nombre slug')
            .sort({ nombre: 1 });
    }

    /**
     * Actualiza línea
     */
    static async update(id: string, data: Partial<IProductLine>) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de línea inválido', 400);
        }

        // Si intentan cambiar el slug, verificamos que no choque con otra línea
        if (data.slug) {
            const exists = await ProductLine.findOne({ 
                slug: data.slug, 
                _id: { $ne: id } // Excluir el documento actual de la búsqueda
            });
            
            if (exists) {
                throw new AppError(`El slug '${data.slug}' ya está ocupado por otra línea.`, 400);
            }
        }

        const line = await ProductLine.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        
        if (!line) {
            throw new AppError('No se encontró la línea para actualizar', 404);
        }
        return line;
    }

    /**
     * Elimina línea (Con protección de integridad)
     */
    static async delete(id: string) {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID de línea inválido', 400);
        }

        // PROTECCIÓN: No borrar si hay productos usando esta línea
        const productsUsingLine = await Product.exists({ line: id });
        
        if (productsUsingLine) {
            throw new AppError(
                'No se puede eliminar: Existen productos vinculados a esta línea. Primero reasigna o elimina los productos.', 
                409
            );
        }

        const deletedLine = await ProductLine.findByIdAndDelete(id);
        
        if (!deletedLine) {
            throw new AppError('Línea no encontrada', 404);
        }

        return deletedLine;
    }
}