import Product from "../../models/Product";
import { FilterQuery } from "mongoose";

export class ProductService {
    /**
     * Listado administrativo con paginación y búsqueda
     */
    async getAllProducts(page: number, limit: number, search: string) {
        const skip = (page - 1) * limit;
        const filter: FilterQuery<any> = {};

        if (search) {
            // Buscamos solo en campos de texto para evitar CastError con los ObjectIds
            filter.$or = [
                { nombre: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { 'variants.sku': { $regex: search, $options: 'i' } },
                { 'variants.barcode': { $regex: search, $options: 'i' } }
            ];
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('categoria', 'nombre')
                .populate('brand', 'nombre')
                .lean(),
            Product.countDocuments(filter)
        ]);

        return {
            products,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        };
    }

    /**
     * Catálogo rápido para el POS (Solo activos)
     */
    async getProductsForPos(query: string = '') {
        const filter: FilterQuery<any> = { isActive: true };

        if (query) {
            filter.$or = [
                { nombre: { $regex: query, $options: 'i' } },
                { barcode: query },
                { sku: query },
                { 'variants.barcode': query },
                { 'variants.sku': query }
            ];
        }

        return await Product.find(filter)
            .populate('categoria', 'nombre')
            .populate('brand', 'nombre')
            .limit(25)
            .lean();
    }

    /**
     * Búsqueda por escáner (Exacta)
     */
    async getProductByBarcode(barcode: string) {
        return await Product.findOne({
            $or: [{ barcode }, { 'variants.barcode': barcode }],
            isActive: true
        })
        .populate('categoria', 'nombre')
        .populate('brand', 'nombre');
    }

    /**
     * Guardar o actualizar producto
     */
    async saveProduct(id: string | undefined, data: any) {
        if (id) {
            return await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
        }
        // Nota: El modelo requiere 'slug'. Si no viene en data, asegúrate de generarlo.
        return await Product.create(data);
    }

    /**
     * Ajuste rápido de inventario
     */
    async updateStock(id: string, newStock: number) {
        return await Product.findByIdAndUpdate(
            id, 
            { $set: { stock: newStock } }, 
            { new: true }
        );
    }

    /**
     * Cambio de visibilidad
     */
    async toggleStatus(id: string, isActive: boolean) {
        return await Product.findByIdAndUpdate(
            id, 
            { $set: { isActive } }, 
            { new: true }
        );
    }

    /**
     * Eliminación física
     */
    async deleteProduct(id: string) {
        return await Product.findByIdAndDelete(id);
    }

    async getProductsByIds(ids: string[]) {


        const products = await Product.find({ _id: { $in: ids } })
            .populate('categoria', 'nombre')
            .populate('brand', 'nombre')
            .lean();
        
        console.log("Productos encontrados por IDs: ", products);

        return products;
    }

    async searchProducts(query: string) {
        const filter: FilterQuery<any> = {};

        if (query) {
            filter.$or = [
                { nombre: { $regex: query, $options: 'i' } },
                { sku: { $regex: query, $options: 'i' } },
                { barcode: { $regex: query, $options: 'i' } },
                { slug: { $regex: query, $options: 'i' } },
                { 'variants.sku': { $regex: query, $options: 'i' } },
                { 'variants.barcode': { $regex: query, $options: 'i' } }
            ];
        }

        console.log("Filtro de búsqueda:", filter);

        return await Product.find(filter)
            .populate('categoria', 'nombre')
            .populate('brand', 'nombre')
            .lean();

    }
}