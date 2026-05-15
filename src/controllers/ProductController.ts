import { Request, Response } from 'express';
import Category from '../models/Category';
import Product, { type IProduct, type IVariant } from '../models/Product';
import formidable from 'formidable';
// import cloudinary from 'cloudinary';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';
import { generateUniqueSlug } from '../utils/slug';
import Brand from '../models/Brand';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Line from '../models/ProductLine';
import { getCategoryFamilyIds } from '../services/category.service';

export class ProductController {
    static async createProduct(req: Request, res: Response) {
        try {
            const { nombre, descripcion, precio, precioComparativo, costo, imagenes, categoria, stock, sku, barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                especificaciones,
                brand,
                diasEnvio,
                variants,
                isFrontPage,
                line,
                tags,
                weight,
                dimensions,
                metaTitle,
                metaDescription,
                complementarios,
            } = req.body;

            const [selectedCategory, hasChildren] = await Promise.all([
                Category.findById(categoria),
                Category.exists({ parent: categoria })
            ]);

            if (!selectedCategory) {
                res.status(400).json({ message: 'La categoría no existe' });
                return;
            }

            if (hasChildren) {
                res.status(400).json({
                    message: 'No se puede crear un producto en una categoría que tiene subcategorías'
                });
                return;
            }

            if (imagenes && imagenes.length > 15) {
                res.status(400).json({ message: 'No se pueden subir más de 15 imágenes' });
                return;
            }

            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Atributos deben ser un objeto' });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: 'Especificaciones deben ser un array' });
                return;
            }

            if (precioComparativo && Number(precioComparativo) < Number(precio)) {
                res.status(400).json({ message: 'El precio comparativo no puede ser menor al precio' });
                return;
            }

            if (tags && !Array.isArray(tags)) {
                res.status(400).json({ message: 'Tags deben ser un array' });
                return;
            }

            if (weight && Number(weight) < 0) {
                res.status(400).json({ message: 'El peso no puede ser negativo' });
                return;
            }

            if (dimensions) {
                const { length, width, height } = dimensions;
                if (
                    (length && length < 0) ||
                    (width && width < 0) ||
                    (height && height < 0)
                ) {
                    res.status(400).json({ message: 'Las dimensiones no pueden ser negativas' });
                    return;
                }
            }

            if (metaTitle && metaTitle.length > 60) {
                res.status(400).json({ message: 'El metaTitle no puede superar los 60 caracteres' });
                return;
            }

            if (metaDescription && metaDescription.length > 160) {
                res.status(400).json({ message: 'La metaDescription no puede superar los 160 caracteres' });
                return;
            }

            const dias = diasEnvio ? Number(diasEnvio) : 1;
            const slug = await generateUniqueSlug(nombre);

            let preparedVariants: IVariant[] = [];

            if (variants && Array.isArray(variants)) {
                preparedVariants = variants.map(v => {
                    if (!v.atributos || typeof v.atributos !== 'object') {
                        throw new Error('Cada variante debe tener atributos válidos');
                    }

                    const nombreGenerado = v.nombre
                        ? v.nombre
                        : Object.keys(v.atributos)
                            .sort()
                            .map(key => `${v.atributos[key]}`)
                            .join(' / ');

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio ? Number(v.precio) : undefined,
                        precioComparativo: v.precioComparativo ? Number(v.precioComparativo) : undefined,
                        stock: v.stock ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos
                    };
                });

                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: 'Variantes duplicadas detectadas' });
                        return;
                    }
                    seen.add(key);
                }
            }

            const totalStockFromVariants =
                preparedVariants.length > 0
                    ? preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0)
                    : stock;

            const newProduct = {
                nombre,
                slug,
                descripcion,
                precio: Number(precio),
                precioComparativo: precioComparativo ? Number(precioComparativo) : undefined,
                costo,
                imagenes,
                categoria,
                stock: totalStockFromVariants,
                sku,
                barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                especificaciones,
                brand,
                diasEnvio: dias,
                variants: preparedVariants,
                isFrontPage,
                line,
                tags: tags ?? [],
                weight: weight ? Number(weight) : undefined,
                dimensions: dimensions ?? undefined,
                metaTitle: metaTitle ?? undefined,
                metaDescription: metaDescription ?? undefined,
                complementarios: complementarios ?? [],
            };

            const product = new Product(newProduct);
            await product.save();

            res.status(201).json({ message: 'Producto creado correctamente' });
        } catch (error: any) {
            console.error('Error creating product:', error);
            res.status(500).json({ message: error.message || 'Error creating product' });
        }
    }

    static async getProducts(req: Request, res: Response) {
        try {
            const {
                page = "1",
                limit = "10",
                nombre,
                sku,
                precioSort,
                stockSort,
                isActive,
                esNuevo,
                esDestacado,
                query,
                brand,
                category,
            } = req.query as Record<string, string>;

            const currentPage = Math.max(parseInt(page) || 1, 1);
            const pageSize = Math.max(parseInt(limit) || 10, 1);
            const skip = (currentPage - 1) * pageSize;

            const filter: Record<string, any> = {};

            // Búsqueda global
            if (query) {
                const searchRegex = new RegExp(query.trim(), "i");
                filter.$or = [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },
                    { sku: { $regex: searchRegex } },
                    { barcode: { $regex: searchRegex } },

                ];
            }

            // Filtros específicos
            if (nombre) filter.nombre = { $regex: new RegExp(nombre, "i") };
            if (sku) filter.sku = { $regex: new RegExp(sku, "i") };

            if (isActive === "true" || isActive === "false") {
                filter.isActive = isActive === "true";
            }

            if (esNuevo === "true" || esNuevo === "false") {
                filter.esNuevo = esNuevo === "true";
            }

            if (esDestacado === "true" || esDestacado === "false") {
                filter.esDestacado = esDestacado === "true";
            }
            if (brand) {
                filter.brand = brand;
            }

            console.log('Category filter value:', category);
            if (category) filter.categoria = new mongoose.Types.ObjectId(category);

            // Ordenamiento
            const sort: Record<string, 1 | -1> = {};

            if (precioSort === "asc" || precioSort === "desc") {
                sort.precio = precioSort === "asc" ? 1 : -1;
            }

            if (stockSort === "asc" || stockSort === "desc") {
                sort.stock = stockSort === "asc" ? 1 : -1;
            }

            // Si no hay sort elegido, ordenar por fecha de actualización
            if (Object.keys(sort).length === 0) {
                sort.updatedAt = -1;
            }

            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(pageSize)
                    .sort(sort)
                    .populate("brand", "nombre slug")
                    // .populate("categoria", "nombre slug")
                    .populate("line", "nombre slug"),

                Product.countDocuments(filter),
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / pageSize),
                currentPage,
                totalProducts,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching products" });
        }
    }

    static async searchListProducts(req: Request, res: Response) {
        const { q } = req.query;
        const limit = 10;
        console.log("Término de búsqueda recibido en searchListProducts:", q);

        if (!q || typeof q !== "string") {
            res.status(400).json({ message: 'Invalid query' });
            return;
        }

        try {
            const products = await Product.find({
                $or: [
                    { nombre: { $regex: q, $options: "i" } },
                    { descripcion: { $regex: q, $options: "i" } },
                    { sku: { $regex: q, $options: "i" } },
                    { barcode: { $regex: q, $options: "i" } },
                ]
            })
                .populate("brand", "nombre slug")
                .limit(limit)
                .lean(); // Forzar objeto plano

            // --- DEPURACIÓN ---
            // Si ves un STRING en la consola en lugar de un OBJETO, 
            // significa que el ID en la DB no existe en la colección Brand.
            console.log("Muestra del primer producto:", products[0]?.brand);

            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error searching products' });
        }
    }

    // Get product with pagination
    static async getNewProducts(req: Request, res: Response) {
        try {
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const products = await Product.find({ esNuevo: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ esNuevo: true });

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            res.status(500).json({ message: 'Error fetching new products' });
            return;
        }
    }

    static async getProductsByFilter(req: Request, res: Response) {
        try {
            const {
                page = '1',
                limit = '10',
                category,
                priceRange,
                sort,
                // Eliminamos 'query' de la desestructuración principal para no considerarlo,
                // pero mantenemos los demás parámetros dinámicos en 'req.query'
            } = req.query as {
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string;
                sort?: string;
                query?: string; // Lo mantenemos opcional en el tipo pero no lo usamos
                [key: string]: string | string[] | undefined;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            // Base de filtros. Usaremos 'filter' como 'searchQuery'
            const filter: Record<string, any> = { isActive: true };

            // --- Categoría (por slug)
            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                if (categoryDoc) {
                    filter.categoria = categoryDoc._id;
                } else {
                    // Si no existe la categoría, forzamos a que no devuelva nada
                    filter.categoria = null;
                }
            }

            // --- Marca (similar a getProductsMainPage, aunque no estaba en la versión anterior de ByFilter)
            const brandSlug = req.query.brand as string;
            if (brandSlug) {
                const brandDoc = await Brand.findOne({ slug: brandSlug });
                if (brandDoc) {
                    filter.brand = brandDoc._id;
                }
            }

            // --- Rango de precios: Considerar precio base O precio de variante
            const priceStr = priceRange;
            if (priceStr) {
                const [minStr, maxStr] = priceStr.split('-');
                const min = Number(minStr);
                const max = Number(maxStr);
                if (!isNaN(min) && !isNaN(max) && min >= 0 && max >= 0 && min <= max) {
                    // Aplicar $or para precio del producto base O precio de la variante
                    filter.$or = [
                        { precio: { $gte: min, $lte: max } },
                        { "variants.precio": { $gte: min, $lte: max } },
                    ];
                } else {
                    res.status(400).json({ message: 'Invalid price range' });
                    return;
                }
            }

            // --- Atributos dinámicos: atributos[Tamaño]=250ml, atributos[Material]=Aluminio, etc.
            // Los filtros de atributos dinámicos deben combinarse con $and para que se apliquen simultáneamente.
            const dynamicAttributeFilters: any[] = [];

            for (const key in req.query) {
                // Aseguramos que solo procesamos los parámetros que comienzan con "atributos[" y terminan con "]"
                if (key.startsWith("atributos[") && key.endsWith("]")) {
                    const attrKey = key.slice(10, -1);
                    const value = req.query[key];

                    if (attrKey.length > 0) {
                        let valuesArray: any[] = [];

                        if (typeof value === "string") {
                            valuesArray = value.split(",").map(v => v.trim()).filter(Boolean);
                        } else if (Array.isArray(value)) {
                            valuesArray = value.map(v => String(v).trim()).filter(Boolean);
                        }

                        if (valuesArray.length > 0) {
                            // Creamos una condición $or para este atributo: (producto padre) OR (alguna variante)
                            dynamicAttributeFilters.push({
                                $or: [
                                    { [`atributos.${attrKey}`]: { $in: valuesArray } },
                                    { variants: { $elemMatch: { [`atributos.${attrKey}`]: { $in: valuesArray } } } }
                                ]
                            });
                        }
                    }
                }
            }

            // Aplicamos todos los filtros de atributos dinámicos juntos con un $and
            if (dynamicAttributeFilters.length > 0) {
                if (!filter.$and) filter.$and = [];
                filter.$and.push(...dynamicAttributeFilters);
            }

            // NOTA: Se elimina la sección de 'orConditions' y 'Texto de búsqueda general' (query)
            // ya que el requisito es ya no buscar productos por query.

            // --- Ordenamiento
            let sortOptions: Record<string, 1 | -1> = { stock: -1, createdAt: -1 };
            if (sort) {
                switch (sort) {
                    case 'price-asc':
                        sortOptions = { precio: 1 };
                        break;
                    case 'price-desc':
                        sortOptions = { precio: -1 };
                        break;
                    case 'name-asc':
                        sortOptions = { nombre: 1 };
                        break;
                    case 'name-desc':
                        sortOptions = { nombre: -1 };
                        break;
                    case 'recientes':
                        sortOptions = { createdAt: -1 };
                        break;
                }
            }

            // --- Consulta a la base de datos
            const [products, totalProducts] = await Promise.all([
                Product.find(filter)
                    .skip(skip)
                    .limit(limitNum)
                    .sort(sortOptions)
                    .populate('brand', 'nombre slug'),
                Product.countDocuments(filter)
            ]);

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
            return;

        } catch (error) {
            console.error('Error fetching products by filter:', error);
            res.status(500).json({ message: 'Error fetching products by filter' });
            return;
        }
    }

    static async searchProducts(req: Request, res: Response) {
        try {
            const { query } = req.query;
            const pageNum = parseInt(req.query.page as string, 10) || 1;
            const limitNum = parseInt(req.query.limit as string, 10) || 10;

            const searchText = query?.toString().trim() || "";

            const searchRegex = new RegExp(searchText, "i"); // 'i' = insensible a mayúsculas/minúsculas

            const filter = {
                $or: [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },

                ]
            };

            const products = await Product.find(filter)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug')
                .populate('line', 'nombre slug')
                ;

            const totalProducts = await Product.countDocuments(filter);

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            console.error('Error searching products:', error);
            res.status(500).json({ message: 'Error al buscar productos' });
        }
    }

    static async searchProductsIndex(req: Request, res: Response) {
        try {
            const { query } = req.query;
            const searchText = query?.toString().trim() || "";

            // Si no hay texto de búsqueda, devolver lista vacía
            if (!searchText) {
                res.status(200).json([]);
                return;
            }

            const pipeline: any[] = [
                // 1. Etapa de Búsqueda (Atlas Search)
                // Usamos el mismo índice 'ecommerce_search_products' que creamos para la página principal
                {
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                {
                                    text: {
                                        query: searchText,
                                        path: "nombre",
                                        score: { boost: { value: 3 } }, // Prioridad 1: Coincidencia en Nombre
                                        fuzzy: { maxEdits: 1 } // Permite pequeños errores (ej: "ipone" -> "iphone")
                                    }
                                },
                                {
                                    text: {
                                        query: searchText,
                                        path: "variants.nombre",
                                        score: { boost: { value: 2 } }, // Prioridad 2: Coincidencia en Variante
                                        fuzzy: { maxEdits: 1 }
                                    }
                                },
                                {
                                    text: {
                                        query: searchText,
                                        path: "descripcion",
                                        score: { boost: { value: 1 } }, // Prioridad 3: Descripción
                                        fuzzy: { maxEdits: 1 }
                                    }
                                }
                            ],
                            minimumShouldMatch: 1 // Al menos una coincidencia es necesaria
                        }
                    }
                },
                // 2. Match (Filtros duros)
                // Filtramos por activos. Nota: Es más eficiente hacer esto después del search
                // a menos que isActive esté indexado como "token" en Atlas Search.
                {
                    $match: {
                        isActive: true
                    }
                },
                // 3. Limit (Solo necesitamos 5 para el dropdown)
                {
                    $limit: 5
                },
                // 4. Project (Equivalente a .select() y .slice())
                {
                    $project: {
                        _id: 1,
                        nombre: 1,
                        precio: 1,
                        precioComparativo: 1,
                        breand: 1,
                        slug: 1,
                        esDestacado: 1,
                        esNuevo: 1,
                        // MongoDB Aggregation usa $slice para recortar arrays
                        imagenes: { $slice: ["$imagenes", 1] }
                    }
                }
            ];

            const products = await Product.aggregate(pipeline);

            res.status(200).json(products);
            return;

        } catch (error) {
            console.error("Error searching products in index:", error);
            res.status(500).json({ message: "Error al buscar productos" });
            return;
        }
    }


    static async mainSearchProducts(req: Request, res: Response) {
        try {

            const { query, page, limit } = req.query;
            const pageNum = parseInt(page as string, 10) || 1;
            const limitNum = parseInt(limit as string, 10) || 10;
            const searchText = query?.toString().trim() || "";

            const searchRegex = new RegExp(searchText, "i"); // 'i' = insensible a mayúsculas/minúsculas

            const filter = {
                $or: [
                    { nombre: { $regex: searchRegex } },
                    { descripcion: { $regex: searchRegex } },
                ]
            };

            const products = await Product.find(filter)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug');

            const totalProducts = await Product.countDocuments(filter);

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });

        } catch (error) {
            //    console.error('Error en la búsqueda principal de productos:', error);
            res.status(500).json({ message: 'Error en la búsqueda principal de productos' });
        }
    }

    static async getProductById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            // populate category to get the name and slug
            const product = await Product.findById(id)
                .select('+costo')
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug')
                .populate('line', 'nombre slug');

            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            res.status(200).json(product);
        } catch (error) {
            res.status(500).json({ message: 'Error obteniendo el producto', error });
            return;
        }
    }

    static async getProductBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const product = await Product.findOne({ slug })
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug')
                .populate('line', 'nombre slug')
                .populate('complementarios', 'nombre precio imagenes slug');

            if (!product) {
                res.status(404).json({ message: 'Product not found' });
                return;
            }
            res.status(200).json(product);
        } catch (error) {

        }
    }

    static async updateProduct(req: Request, res: Response) {
        try {
            const {
                nombre,
                descripcion,
                precio,
                precioComparativo,
                costo,
                imagenes,
                categoria,
                stock,
                sku,
                barcode,
                esDestacado,
                esNuevo,
                isActive,
                atributos,
                especificaciones,
                brand,
                diasEnvio,
                variants,
                isFrontPage,
                line,
                complementarios
            } = req.body;

            console.log('complentario llego:', req.body.complementarios);

            const productId = req.params.id;
            const existingProduct = await Product.findById(productId);

            if (!existingProduct) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            if (imagenes && imagenes.length > 15) {
                res.status(400).json({ message: 'No se pueden subir más de 15 imágenes' });
                return;
            }

            if (atributos && typeof atributos !== 'object') {
                res.status(400).json({ message: 'Los atributos deben ser un objeto' });
                return;
            }

            if (especificaciones && !Array.isArray(especificaciones)) {
                res.status(400).json({ message: 'Las especificaciones deben ser un array' });
                return;
            }

            if (categoria) {
                const categoryExists = await Category.findById(categoria);
                if (!categoryExists) {
                    res.status(400).json({ message: 'La categoría especificada no existe' });
                    return;
                }
                existingProduct.categoria = categoria;
            }

            const dias = diasEnvio ? Number(diasEnvio) : existingProduct.diasEnvio;

            if (Array.isArray(variants) && variants.length > 0) {
                const preparedVariants = variants.map(v => {
                    if (!v.atributos || typeof v.atributos !== 'object')
                        throw new Error('Cada variante debe tener atributos válidos');

                    const nombreGenerado =
                        v.nombre ||
                        Object.keys(v.atributos)
                            .sort()
                            .map(key => `${v.atributos[key]}`)
                            .join(' / ');

                    let precioComparativoFinal =
                        v.precioComparativo != null ? Number(v.precioComparativo) : undefined;

                    if (
                        precioComparativoFinal !== undefined &&
                        (precioComparativoFinal <= 0 ||
                            (v.precio != null &&
                                precioComparativoFinal < Number(v.precio)))
                    ) {
                        precioComparativoFinal = undefined;
                    }

                    return {
                        nombre: nombreGenerado,
                        precio: v.precio != null ? Number(v.precio) : undefined,
                        precioComparativo: precioComparativoFinal,
                        stock: v.stock != null ? Number(v.stock) : 0,
                        sku: v.sku,
                        barcode: v.barcode,
                        imagenes: v.imagenes ?? [],
                        atributos: v.atributos
                    };
                });

                const seen = new Set();
                for (const v of preparedVariants) {
                    const key = JSON.stringify(v.atributos);
                    if (seen.has(key)) {
                        res.status(400).json({ message: 'Variantes duplicadas detectadas' });
                        return;
                    }
                    seen.add(key);
                }

                existingProduct.variants = preparedVariants;
                existingProduct.stock = preparedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
            } else {
                existingProduct.variants = [];
                if (stock != null) existingProduct.stock = Number(stock);
            }

            if (nombre && nombre !== existingProduct.nombre) {
                existingProduct.slug = await generateUniqueSlug(nombre);
                existingProduct.nombre = nombre;
            }

            if (descripcion) existingProduct.descripcion = descripcion;
            if (precio != null) existingProduct.precio = Number(precio);

            if (
                precioComparativo !== undefined &&
                precioComparativo !== null &&
                Number(precioComparativo) > 0 &&
                (precio == null || Number(precioComparativo) >= Number(precio))
            ) {
                existingProduct.precioComparativo = Number(precioComparativo);
            } else {
                existingProduct.precioComparativo = undefined;
            }

            if (costo != null) existingProduct.costo = Number(costo);
            if (imagenes) existingProduct.imagenes = imagenes;
            if (sku) existingProduct.sku = sku;
            if (barcode) existingProduct.barcode = barcode;
            if (brand) existingProduct.brand = brand;
            if (atributos) existingProduct.atributos = atributos;
            if (especificaciones) existingProduct.especificaciones = especificaciones;

            existingProduct.diasEnvio = dias;
            existingProduct.esDestacado = esDestacado ?? existingProduct.esDestacado;
            existingProduct.esNuevo = esNuevo ?? existingProduct.esNuevo;
            existingProduct.isActive = isActive ?? existingProduct.isActive;
            existingProduct.isFrontPage = isFrontPage ?? existingProduct.isFrontPage;
            existingProduct.line = line ?? existingProduct.line;
            existingProduct.complementarios = complementarios ?? existingProduct.complementarios;

            await existingProduct.save();

            res.status(200).json({ message: 'Producto actualizado correctamente' });
        } catch (error: any) {
            console.error('Error updating product:', error);
            res.status(500).json({ message: 'Error actualizando producto', error: error.message });
        }
    }



    static async deleteProduct(req: Request, res: Response) {
        try {
            const productId = req.params.id;
            const product = await Product.findById(productId);
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }
            await product.deleteOne();
            res.status(200).json({ message: 'Producto eliminado correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error eliminando el producto' });
            return;
        }
    }

    static async getProductsByCategory(req: Request, res: Response) {
        try {
            const { categoryId } = req.params;
            const category = await Category.findById(categoryId)
                .select('nombre slug')
                .lean(); // Use lean() to return a plain JavaScript object


            if (!category) {
                res.status(404).json({ message: 'Category no encontrada' });
                return;
            }
            const products = await Product.find({ categoria: categoryId })
                .populate('categoria', 'nombre slug')
                .populate('brand', 'nombre slug')
                .lean(); // Use lean() to return plain JavaScript objects
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching products by category', error });
            return;
        }
    }

    static async uploadImagesToProduct(req: Request, res: Response) {
        const form = formidable({
            multiples: true  // Permite recibir varios archivos
        }); //

        form.parse(req, async (error, fields, files) => {
            if (error) {
                console.error("Error al procesar los archivos:", error);
                res.status(400).json({ message: 'Error al procesar los archivos' });
                return;
            }

            // Verifica si se reciben las imágenes
            if (!files.images) {
                res.status(400).json({ message: 'No se han recibido imágenes' });
                return;
            }

            // images es un array si se sube una sola imagen o un objeto si se suben varias
            // The key 'images' is used in the form data
            const images = Array.isArray(files.images) ? files.images : [files.images];

            if (images.length > 15) {
                res.status(400).json({ message: 'No se pueden subir más de 15 imágenes' });
                return;
            }

            try {
                const imageUrls = [];
                // Subir las imágenes a Cloudinary
                const uploadPromises = images.map((image) => {
                    return cloudinary.uploader.upload(image.filepath, {
                        public_id: uuid(),
                        folder: 'products',
                    });
                });

                // Esperar que todas las imágenes se suban
                const results = await Promise.all(uploadPromises);

                // Extraer las URLs de las imágenes subidas
                results.forEach(result => {
                    imageUrls.push(result.secure_url);
                });

                // Obtener el lugar por ID y actualizar sus imágenes
                const { id } = req.params;

                // Add images o mantener las imágenes existentes
                const updatedProduct = await Product.findByIdAndUpdate(
                    id,
                    { $addToSet: { imagenes: { $each: imageUrls } } }, // Añadir imágenes sin duplicados
                    { new: true } // Devuelve el documento actualizado
                );

                // verificar si el producto ya tiene 15 imágenes
                if (updatedProduct && updatedProduct.imagenes.length > 15) {
                    // Eliminar la imagen más antigua
                    updatedProduct.imagenes.shift(); // Elimina la primera imagen (la más antigua)
                    await updatedProduct.save(); // Guarda los cambios
                }

                if (!updatedProduct) {
                    res.status(404).json({ message: 'Producto no encontrado' });
                    return;
                }

                res.status(200).json({ message: 'Imágenes subidas correctamente', images: imageUrls });

            } catch (error) {
                // console.error("Error al subir las imágenes:", error);
                res.status(500).json({ message: 'Error al subir las imágenes' });
                return;
            }
        });
    };


    static async uploadImageCloudinary(req: Request, res: Response) {

        const form = formidable({ multiples: true });

        form.parse(req, async (error, fields, files) => {
            if (error) {
                console.error("Error al procesar los archivos:", error);
                res.status(400).json({ message: "Error al procesar los archivos" });
                return;
            }

            if (!files.images) {
                res.status(400).json({ message: "No se han recibido imágenes" });
                return;
            }

            const images = Array.isArray(files.images) ? files.images : [files.images];

            if (images.length > 15) {
                res.status(400).json({ message: "No se pueden subir más de 15 imágenes" });
                return;
            }

            try {
                const imageUrls = [];

                const uploadPromises = images.map(async (image) => {

                    // Convertir a WEBP usando SHARP
                    const webpBuffer = await sharp(image.filepath)
                        .webp({ quality: 85 }) //
                        .toBuffer();

                    // Subir buffer WebP a Cloudinary
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            {
                                public_id: uuid(),
                                folder: "products",
                                format: "webp"
                            },
                            (err, result) => {
                                if (err) reject(err);
                                else resolve(result);
                            }
                        );

                        stream.end(webpBuffer); // Enviar buffer convertido
                    });
                });

                const results: any = await Promise.all(uploadPromises);

                results.forEach(result => {
                    imageUrls.push(result.secure_url);
                });

                res.status(200).json({ images: imageUrls });
                return;

            } catch (error) {
                console.error("Error al subir las imágenes:", error);

                res.status(500).json({ message: "Error al subir las imágenes" });
                return;
            }
        });
    }


    static async getAllImagesFromCloudinary(req: Request, res: Response) {
        try {
            const resources = await cloudinary.api.resources({
                type: 'upload',
                prefix: 'products/',
                max_results: 100
            });
            const imageUrls = resources.resources.map((resource: any) => resource.secure_url);
            res.status(200).json({ images: imageUrls });
        } catch (error) {
            console.error("Error al obtener las imágenes:", error);
            res.status(500).json({ message: 'Error al obtener las imágenes' });
        }
    }

    static async updateProductStatus(req: Request, res: Response) {
        const { id } = req.params;
        const { isActive } = req.body;

        try {
            const product = await Product.findById(id);
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            product.isActive = isActive;
            await product.save();

            res.status(200).json({ message: `Estado del producto actualizado correctamente a ${isActive ? 'activo' : 'inactivo'}` });
        } catch (error) {
            // console.error("Error al actualizar el estado del producto:", error);
            res.status(500).json({ message: 'Error al actualizar el estado del producto' });
            return;
        }
    }

    static async getProductsRelated(req: Request, res: Response) {
        const { slug } = req.params;
        const LIMIT_TOTAL = 6; // Límite total de productos a mostrar

        try {
            // 1. Encontrar el producto base
            // Necesitamos saber su ID, Categoría, Marca y LÍNEA
            const product = await Product.findOne({ slug })
                .select('_id categoria brand line');

            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            const currentProductId = product._id as Types.ObjectId;
            const categoryId = product.categoria as Types.ObjectId;
            const brandId = product.brand as Types.ObjectId;
            const lineId = product.line as Types.ObjectId; // ID de la línea actual

            const selectedIds = new Set<string>([currentProductId.toString()]);
            let recommendedProducts: IProduct[] = [];

            // =================================================================
            // 🥇 ESTRATEGIA 1: MISMA LÍNEA (La más relevante)
            // =================================================================
            // Si estoy viendo un iPhone 16, muéstrame otros iPhone 16 (colores, capacidades)

            if (lineId) {
                const sameLineProducts = await Product.find({
                    line: lineId,
                    _id: { $ne: currentProductId },
                    isActive: true
                })
                    .limit(LIMIT_TOTAL)
                    .populate('brand', 'nombre slug')
                    .populate('line', 'nombre slug')
                    .lean();

                sameLineProducts.forEach(p => {
                    selectedIds.add(p._id.toString());
                    recommendedProducts.push(p);
                });
            }

            if (recommendedProducts.length >= LIMIT_TOTAL) {
                res.status(200).json(recommendedProducts.slice(0, LIMIT_TOTAL));
                return;
            }

            // =================================================================
            // 🥈 ESTRATEGIA 2: MISMA CATEGORÍA (Aleatorio)
            // =================================================================

            const excludedIdsArray = Array.from(selectedIds).map(id => new mongoose.Types.ObjectId(id));

            const categoryMatch = {
                categoria: categoryId,
                _id: { $nin: excludedIdsArray }, // Excluir los ya seleccionados (propio + línea)
                isActive: true
            };

            const randomCategoryProducts = await Product.aggregate([
                { $match: categoryMatch },
                { $sample: { size: LIMIT_TOTAL } }, // Tomamos una muestra
                // Lookup Marca
                {
                    $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' }
                },
                { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                // Lookup Línea (IMPORTANTE: preserveNullAndEmptyArrays true para productos sin línea)
                {
                    $lookup: { from: 'lines', localField: 'line', foreignField: '_id', as: 'line' }
                },
                { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },

                { $project: { __v: 0 } }
            ]);

            randomCategoryProducts.forEach((p: any) => {
                if (!selectedIds.has(p._id.toString())) {
                    selectedIds.add(p._id.toString());
                    recommendedProducts.push(p);
                }
            });

            if (recommendedProducts.length >= LIMIT_TOTAL) {
                res.status(200).json(recommendedProducts.slice(0, LIMIT_TOTAL));
                return;
            }

            // =================================================================
            // 🥉 ESTRATEGIA 3: MISMA MARCA (Relleno)
            // =================================================================

            if (brandId) {
                // Actualizamos excluidos
                const currentExcludedIds = Array.from(selectedIds);

                const brandProducts = await Product.find({
                    brand: brandId,
                    _id: { $nin: currentExcludedIds },
                    isActive: true
                })
                    .limit(LIMIT_TOTAL - recommendedProducts.length)
                    .sort({ 'esDestacado': -1, createdAt: -1 })
                    .populate('brand', 'nombre slug')
                    .populate('line', 'nombre slug')
                    .lean();

                brandProducts.forEach(p => {
                    selectedIds.add(p._id.toString());
                    recommendedProducts.push(p);
                });
            }
            res.status(200).json(recommendedProducts.slice(0, LIMIT_TOTAL));

        } catch (error) {
            console.error("Error al obtener productos relacionados:", error);
            res.status(500).json({ message: 'Error al obtener productos relacionados' });
        }
    }

    static async getDestacadosProducts(req: Request, res: Response) {
        try {
            // add pagination
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;
            // Obtener productos destacados
            const products = await Product.find({ esDestacado: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ esDestacado: true });
            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos destacados' });
                return;
            }
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching featured products' });
            return;
        }
    }

    static async getFrontPageProducts(req: Request, res: Response) {
        try {
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            const products = await Product.find({ isFrontPage: true })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ isFrontPage: true });

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos para la página principal' });
                return;
            }

            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching front page products' });
            return;
        }

    }

    static async getAllProductsSlug(req: Request, res: Response) {
        try {
            const products = await Product.find().select('slug updatedAt')
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching all products slug' });
            return;
        }
    }

    static async getProductsByBrandSlug(req: Request, res: Response) {
        try {
            const { brandSlug } = req.params;
            const { page = '1', limit = '10' } = req.query as {
                page?: string;
                limit?: string;
            };

            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const skip = (pageNum - 1) * limitNum;

            console.log('brandSlug:', brandSlug);
            const brand = await Brand.findOne({ slug: brandSlug });
            console.log('brand:', brand);
            if (!brand) {
                res.status(404).json({ message: 'Marca no encontrada' });
                return;
            }
            const products = await Product.find({ brand: brand._id })
                .skip(skip)
                .limit(limitNum)
                .sort({ createdAt: -1 })
                .populate('brand', 'nombre slug')
            // .populate('categoria', 'nombre slug');

            const totalProducts = await Product.countDocuments({ brand: brand._id });

            if (products.length === 0) {
                res.status(404).json({ message: 'No se encontraron productos para esta marca' });
                return;
            }
            res.status(200).json({
                products,
                totalPages: Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener productos por marca' });
            return;
        }
    }


    static async getProductsMainPage(req: Request, res: Response) {
        try {
            const { query, page, limit, category, priceRange, sort, ...rest } = req.query as {
                query?: string;
                page?: string;
                limit?: string;
                category?: string;
                priceRange?: string;
                sort?: string;
                [key: string]: any;
            };

            const pageNum = parseInt(page || "1", 10);
            const limitNum = parseInt(limit || "10", 10);
            const skip = (pageNum - 1) * limitNum;

            // 1. Construir el Pipeline Base (Search + Match)
            const basePipeline: any[] = [];

            // A) ETAPA $SEARCH (Solo si hay query de texto)
            if (query && query.trim() !== "") {
                basePipeline.push({
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                { text: { query: query, path: "nombre", score: { boost: { value: 3 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "variants.nombre", score: { boost: { value: 2 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "descripcion", fuzzy: { maxEdits: 1 } } }
                            ],
                            minimumShouldMatch: 1
                        }
                    }
                });
            }

            // B) ETAPA $MATCH (Filtros duros)
            const matchStage: any = { isActive: true };

            if (category) {
                const categoryDoc = await Category.findOne({ slug: category });
                matchStage.categoria = categoryDoc ? categoryDoc._id : null;
            }

            if (rest.brand) {
                const brandDoc = await Brand.findOne({ slug: rest.brand });
                if (brandDoc) matchStage.brand = brandDoc._id;
            }

            if (priceRange) {
                const [minStr, maxStr] = priceRange.split("-");
                const min = Number(minStr);
                const max = Number(maxStr);
                if (!isNaN(min) && !isNaN(max)) {
                    matchStage.$or = [
                        { precio: { $gte: min, $lte: max } },
                        { "variants.precio": { $gte: min, $lte: max } }
                    ];
                }
            }

            // Filtros Dinámicos (Atributos)
            const activeFilters: Record<string, string[]> = {};
            const attributeFilters: any[] = [];

            Object.keys(rest).forEach((key) => {
                if (["brand", "category", "priceRange", "sort", "page", "limit", "query"].includes(key)) return;

                const values = Array.isArray(rest[key]) ? rest[key] : [rest[key]];
                if (values.length > 0) {
                    activeFilters[key] = values;
                    attributeFilters.push({
                        $or: [
                            { [`atributos.${key}`]: { $in: values } },
                            { variants: { $elemMatch: { [`atributos.${key}`]: { $in: values } } } }
                        ]
                    });
                }
            });

            if (attributeFilters.length > 0) {
                matchStage.$and = attributeFilters;
            }

            basePipeline.push({ $match: matchStage });

            // 2. Definir Ordenamiento (Sort)
            let sortStage: any = {};

            if (sort) {
                switch (sort) {
                    case "price-asc": sortStage = { precio: 1 }; break;
                    case "price-desc": sortStage = { precio: -1 }; break;
                    case "recientes": sortStage = { createdAt: -1 }; break;
                    case "name-asc": sortStage = { nombre: 1 }; break;
                    case "name-desc": sortStage = { nombre: -1 }; break;
                    default: sortStage = { stock: -1, createdAt: -1 };
                }
            } else if (query && query.trim() !== "") {
                sortStage = { unused: { $meta: "searchScore" } };
            } else {
                sortStage = { stock: -1, createdAt: -1 };
            }

            // 3. Ejecutar Aggregations en Paralelo

            // A. Obtener Productos
            const productsPipeline = [
                ...basePipeline,
                ...(Object.keys(sortStage).length > 0 && !sortStage.unused ? [{ $sort: sortStage }] : []),
                { $skip: skip },
                { $limit: limitNum },
                {
                    $lookup: {
                        from: "brands",
                        localField: "brand",
                        foreignField: "_id",
                        as: "brand"
                    }
                },
                { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        nombre: 1, slug: 1, descripcion: 1, precio: 1, precioComparativo: 1, costo: 1,
                        imagenes: 1, categoria: 1, brand: { _id: 1, nombre: 1, slug: 1 },
                        stock: 1, sku: 1, barcode: 1, isActive: 1, esDestacado: 1, esNuevo: 1,
                        atributos: 1, especificaciones: 1, diasEnvio: 1, fechaDisponibilidad: 1, variants: 1,
                        createdAt: 1, updatedAt: 1
                    }
                }
            ];

            // B. Obtener Conteo Total
            const countPipeline = [
                ...basePipeline,
                { $count: "total" }
            ];

            // C. Obtener Filtros (Facets)
            const filtersPipeline = [
                ...basePipeline,
                {
                    $facet: {
                        brands: [
                            { $group: { _id: "$brand" } },
                            { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "brand" } },
                            { $unwind: "$brand" },
                            { $project: { id: "$brand._id", nombre: "$brand.nombre", slug: "$brand.slug" } },
                        ],
                        categories: [
                            { $group: { _id: "$categoria" } },
                            { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
                            { $unwind: "$category" },
                            { $project: { id: "$category._id", nombre: "$category.nombre", slug: "$category.slug" } },
                        ],
                        atributos: [
                            {
                                $project: {
                                    combinedAtributos: {
                                        $concatArrays: [
                                            { $objectToArray: "$atributos" },
                                            {
                                                $reduce: {
                                                    input: "$variants",
                                                    initialValue: [],
                                                    in: { $concatArrays: ["$$value", { $objectToArray: "$$this.atributos" }] }
                                                }
                                            }
                                        ]
                                    }
                                }
                            },
                            { $unwind: { path: "$combinedAtributos", preserveNullAndEmptyArrays: true } },
                            {
                                $project: {
                                    key: "$combinedAtributos.k",
                                    value: "$combinedAtributos.v"
                                }
                            },
                            { $match: { key: { $exists: true, $ne: "" } } },
                            {
                                $group: {
                                    _id: "$key",
                                    values: { $addToSet: "$value" }
                                }
                            },
                            {
                                $project: {
                                    name: "$_id",
                                    values: { $filter: { input: "$values", as: "v", cond: { $ne: ["$$v", null] } } },
                                    _id: 0
                                }
                            }
                        ],
                        price: [
                            {
                                $group: {
                                    _id: null,
                                    min: { $min: { $ifNull: ["$precio", { $min: "$variants.precio" }] } },
                                    max: { $max: { $ifNull: ["$precio", { $max: "$variants.precio" }] } },
                                },
                            },
                        ],
                    }
                }
            ];

            const [productsResult, countResult, filtersResult] = await Promise.all([
                Product.aggregate(productsPipeline),
                Product.aggregate(countPipeline),
                Product.aggregate(filtersPipeline)
            ]);

            const rawProducts = productsResult;
            const totalProducts = countResult.length > 0 ? countResult[0].total : 0;

            // MongoDB $facet siempre retorna un array con 1 documento.
            // Si filtersResult es [{ brands: [], ... }], filters será { brands: [], ... }
            const filters = filtersResult.length > 0 ? filtersResult[0] : {};

            // =================================================================================
            // Procesamiento de imagenes
            // =================================================================================

            const processedProducts = rawProducts.map((product: any) => {
                if (Object.keys(activeFilters).length === 0 || !product.variants || product.variants.length === 0) {
                    return product;
                }

                const matchedVariant = product.variants.find((variant: any) => {
                    return Object.keys(activeFilters).some((filterKey) => {
                        const variantAttrValue = variant.atributos ? variant.atributos[filterKey] : null;
                        return variantAttrValue && activeFilters[filterKey].includes(variantAttrValue);
                    });
                });

                if (matchedVariant && matchedVariant.imagenes && matchedVariant.imagenes.length > 0) {
                    const mainImages = product.imagenes || [];
                    const variantImages = matchedVariant.imagenes;
                    const uniqueMainImages = mainImages.filter((img: string) => !variantImages.includes(img));

                    return {
                        ...product,
                        imagenes: [...variantImages, ...uniqueMainImages],
                        matchedVariantId: matchedVariant._id
                    };
                }

                return product;
            });

            // =================================================================================

            let finalProducts = processedProducts;
            let isFallback = false;

            if (rawProducts.length === 0 && pageNum === 1) {
                isFallback = true;
                finalProducts = await Product.aggregate([
                    { $match: { isActive: true, stock: { $gt: 0 } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 4 },
                    {
                        $lookup: {
                            from: "brands",
                            localField: "brand",
                            foreignField: "_id",
                            as: "brand"
                        }
                    },
                    { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } }
                ]);
            }

            res.status(200).json({
                products: finalProducts,
                totalPages: isFallback ? 1 : Math.ceil(totalProducts / limitNum),
                currentPage: pageNum,
                totalProducts: finalProducts.length, // Ojo: Si es fallback, muestra length de fallback, si prefieres mostrar 0 usa totalProducts
                filters: filters,
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error fetching main page products" });
            return;
        }
    }



    // Reutiliza la potencia del motor de búsqueda y filtros, pero restringido a descuentos.
    static async getOffers(req: Request, res: Response) {
        try {
            const { slugs, page, limit, sort, priceRange, query, ...attributeFilters } = req.query as any;

            const pageNum = Math.max(1, parseInt(page || "1", 10));
            const limitNum = Math.max(1, parseInt(limit || "24", 10));
            const skip = (pageNum - 1) * limitNum;
            const slugArray = slugs ? slugs.split(',').filter(Boolean) : [];

            // 1. RESOLVER CONTEXTO (Permite filtrar ofertas por Marca/Categoría si se envían slugs)
            const context = await ProductController.resolveContext(slugArray);

            const pipeline: any[] = [];

            // =================================================================
            // 🧠 FASE 1: BÚSQUEDA (Si el usuario busca dentro de ofertas)
            // =================================================================
            if (query && query.trim() !== "") {
                pipeline.push({
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                { text: { query: query, path: "nombre", score: { boost: { value: 3 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "variants.nombre", score: { boost: { value: 2 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "descripcion", fuzzy: { maxEdits: 1 } } }
                            ],
                            minimumShouldMatch: 1
                        }
                    }
                });
            }

            // =================================================================
            // 🧠 FASE 2: FILTRO MAESTRO DE OFERTAS
            // =================================================================
            const matchStage: any = {
                isActive: true,
                // 🔥 CONDICIÓN DE OFERTA: Debe tener precioComparativo y ser mayor al precio actual
                precioComparativo: { $exists: true, $ne: null },
                $expr: { $gt: ["$precioComparativo", "$precio"] }
            };

            // Aplicar filtros de contexto (Si el usuario filtra "Apple" dentro de la página de ofertas)
            if (context.category) matchStage.categoria = context.category._id;
            if (context.brand) matchStage.brand = context.brand._id;
            if (context.line) matchStage.line = context.line._id;

            // Filtro de Rango de Precio
            if (priceRange) {
                const [min, max] = priceRange.split('-').map(Number);
                if (!isNaN(min) && !isNaN(max)) {
                    // Nota: Aquí usamos $and para no sobrescribir el $or si lo hubiera
                    matchStage.$and = matchStage.$and || [];
                    matchStage.$and.push({
                        $or: [
                            { precio: { $gte: min, $lte: max } },
                            { "variants.precio": { $gte: min, $lte: max } }
                        ]
                    });
                }
            }

            // Filtros de Atributos Dinámicos
            const attrConditions: any[] = [];
            const reservedKeys = ['limit', 'slugs', 'page', 'sort', 'priceRange', 'query'];

            Object.keys(attributeFilters).forEach((key) => {
                if (reservedKeys.includes(key)) return;
                const rawVal = attributeFilters[key];
                const values = Array.isArray(rawVal) ? rawVal : [rawVal];

                if (values.length > 0) {
                    attrConditions.push({
                        $or: [
                            { [`atributos.${key}`]: { $in: values } },
                            { variants: { $elemMatch: { [`atributos.${key}`]: { $in: values } } } }
                        ]
                    });
                }
            });

            if (attrConditions.length > 0) {
                matchStage.$and = matchStage.$and || [];
                matchStage.$and.push(...attrConditions);
            }

            // Si el array $and quedó vacío, lo borramos para limpieza
            if (matchStage.$and && matchStage.$and.length === 0) delete matchStage.$and;

            pipeline.push({ $match: matchStage });

            // =================================================================
            // 🧠 FASE 3: ORDENAMIENTO
            // =================================================================
            let sortStage: any = {};

            if (sort) {
                switch (sort) {
                    case 'price-asc': sortStage = { precio: 1 }; break;
                    case 'price-desc': sortStage = { precio: -1 }; break;
                    case 'name-asc': sortStage = { nombre: 1 }; break;
                    case 'recientes': sortStage = { createdAt: -1 }; break;
                    default: sortStage = { esDestacado: -1, stock: -1 }; // Prioridad a destacados en ofertas
                }
            } else if (query && query.trim() !== "") {
                sortStage = { unused: { $meta: "searchScore" } };
            } else {
                // Default Ofertas: Destacados primero, luego los de mayor descuento (opcional)
                sortStage = { esDestacado: -1, createdAt: -1 };
            }

            // =================================================================
            // 🧠 FASE 4: FACETAS (Igual que Catalog)
            // =================================================================
            // Copiamos la lógica de facetas para que los filtros funcionen igual
            pipeline.push({
                $facet: {
                    products: [
                        ...(sortStage.unused ? [{ $sort: { score: { $meta: "searchScore" } } }] : [{ $sort: sortStage }]),
                        { $skip: skip },
                        { $limit: limitNum },
                        // Lookups estándar
                        { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
                        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                        { $addFields: { lineObjectId: { $toObjectId: "$line" } } },
                        { $lookup: { from: 'lines', localField: 'lineObjectId', foreignField: '_id', as: 'line' } },
                        { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                nombre: 1, slug: 1, precio: 1, precioComparativo: 1,
                                imagenes: 1, stock: 1, atributos: 1, variants: 1,
                                brand: { nombre: 1, slug: 1 },
                                line: { nombre: 1, slug: 1 },
                                categoria: 1, esDestacado: 1,
                                score: { $meta: "searchScore" }
                            }
                        }
                    ],
                    totalCount: [{ $count: 'count' }],

                    // Facetas (Solo mostrarán marcas/categorías que tengan productos en OFERTA)
                    brands: [
                        { $group: { _id: "$brand" } },
                        { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "b" } },
                        { $unwind: "$b" },
                        { $project: { id: "$b._id", nombre: "$b.nombre", slug: "$b.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    lines: [
                        { $match: { line: { $exists: true, $ne: null } } },
                        { $group: { _id: "$line" } },
                        { $addFields: { lineIdObj: { $toObjectId: "$_id" } } },
                        { $lookup: { from: "lines", localField: "lineIdObj", foreignField: "_id", as: "l" } },
                        { $unwind: "$l" },
                        { $project: { id: "$l._id", nombre: "$l.nombre", slug: "$l.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    categories: [
                        { $group: { _id: "$categoria" } },
                        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "c" } },
                        { $unwind: "$c" },
                        { $project: { id: "$c._id", nombre: "$c.nombre", slug: "$c.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    atributos: [
                        {
                            $project: {
                                allAttrs: {
                                    $concatArrays: [
                                        { $objectToArray: { $ifNull: ["$atributos", {}] } },
                                        { $reduce: { input: { $ifNull: ["$variants", []] }, initialValue: [], in: { $concatArrays: ["$$value", { $objectToArray: { $ifNull: ["$$this.atributos", {}] } }] } } }
                                    ]
                                }
                            }
                        },
                        { $unwind: "$allAttrs" },
                        { $group: { _id: "$allAttrs.k", values: { $addToSet: "$allAttrs.v" } } },
                        { $project: { name: "$_id", values: 1, _id: 0 } },
                        { $sort: { name: 1 } }
                    ],
                    price: [
                        { $group: { _id: null, min: { $min: "$precio" }, max: { $max: "$precio" } } }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline);
            const data = result[0];
            const totalProducts = data.totalCount[0]?.count || 0;

            // En Ofertas, si no hay resultados, no solemos hacer fallback a "destacados generales"
            // porque confundiría al usuario (mostraría productos sin descuento).
            // Pero podemos devolver un array vacío limpio.

            res.status(200).json({
                products: data.products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum) || 1,
                    totalItems: totalProducts
                },
                filters: {
                    brands: data.brands || [],
                    lines: data.lines || [],
                    categories: data.categories || [],
                    atributos: data.atributos || [],
                    price: data.price || []
                },
                context: {
                    // En getOffers, el contexto suele ser el título de la sección, 
                    // pero si se filtró por marca, lo devolvemos.
                    categoryName: context.category ? (context.category as any).nombre : "Ofertas",
                    brandName: context.brand ? (context.brand as any).nombre : null,
                    lineName: context.line ? (context.line as any).nombre : null,
                    searchQuery: query || null
                },
                isFallback: false // No fallback en ofertas para mantener la integridad de "descuento real"
            });

        } catch (error: any) {
            console.error("Error en getOffers:", error);
            res.status(500).json({ message: error.message || "Error fetching offers" });
        }
    }



    // 🧠 HELPER: Resolución de Contexto Inteligente
    // Este helper maneja automáticamente la jerarquía. Si la URL es /audio/audifonos,
    // el bucle asignará primero 'audio' y luego sobrescribirá con 'audifonos',
    // asegurando que siempre filtremos por la categoría más específica.
    private static async resolveContext(slugArray: string[]) {
        if (!slugArray || slugArray.length === 0) {
            return { category: null, brand: null, line: null };
        }

        // Buscamos en todas las colecciones para saber qué es cada slug
        const [foundCats, foundBrands, foundLines] = await Promise.all([
            Category.find({ slug: { $in: slugArray } }).select('_id slug nombre').lean(),
            Brand.find({ slug: { $in: slugArray } }).select('_id slug nombre').lean(),
            Line.find({ slug: { $in: slugArray } }).select('_id slug nombre').lean()
        ]);

        let category = null;
        let brand = null;
        let line = null;

        slugArray.forEach((slug) => {
            const c = foundCats.find(x => x.slug === slug);
            const b = foundBrands.find(x => x.slug === slug);
            const l = foundLines.find(x => x.slug === slug);

            // La lógica "Last Win" (el último gana) es natural aquí:
            // Si hay dos categorías en el slugArray, la última reemplaza a la anterior.
            if (c) category = c;
            else if (b) brand = b;
            else if (l) line = l;
        });

        return { category, brand, line };
    }

    static async getCatalogBySlugs(req: Request, res: Response) {
        try {
            const { slugs, page, limit, sort, priceRange, query, ...attributeFilters } = req.query as any;

            const pageNum = Math.max(1, parseInt(page || "1", 10));
            const limitNum = Math.max(1, parseInt(limit || "24", 10));
            const skip = (pageNum - 1) * limitNum;
            const slugArray = slugs ? slugs.split(',').filter(Boolean) : [];

            // 1. RESOLVER CONTEXTO
            const context = await ProductController.resolveContext(slugArray);

            const pipeline: any[] = [];

            // =================================================================
            // FASE 1: BÚSQUEDA Y FILTROS
            // =================================================================

            // A. ETAPA $SEARCH (Atlas Search)
            if (query && query.trim() !== "") {
                pipeline.push({
                    $search: {
                        index: "ecommerce_search_products",
                        compound: {
                            should: [
                                { text: { query: query, path: "nombre", score: { boost: { value: 3 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "variants.nombre", score: { boost: { value: 2 } }, fuzzy: { maxEdits: 1 } } },
                                { text: { query: query, path: "descripcion", fuzzy: { maxEdits: 1 } } }
                            ],
                            minimumShouldMatch: 1
                        }
                    }
                });
            }

            // B. ETAPA $MATCH
            const matchStage: any = { isActive: true };

            if (context.category) {
                const rootId = context.category._id.toString();
                const rawFamilyIds = await getCategoryFamilyIds(rootId);
                const familyObjectIds = rawFamilyIds.map((id: any) => new Types.ObjectId(id));
                matchStage.categoria = { $in: familyObjectIds };
            }

            if (context.brand) matchStage.brand = context.brand._id;
            if (context.line) matchStage.line = context.line._id;

            if (priceRange) {
                const [min, max] = priceRange.split('-').map(Number);
                if (!isNaN(min) && !isNaN(max)) {
                    matchStage.$or = [
                        { precio: { $gte: min, $lte: max } },
                        { "variants.precio": { $gte: min, $lte: max } }
                    ];
                }
            }

            const attrConditions: any[] = [];
            const reservedKeys = ['limit', 'slugs', 'page', 'sort', 'priceRange', 'query'];

            Object.keys(attributeFilters).forEach((key) => {
                if (reservedKeys.includes(key)) return;
                const rawVal = attributeFilters[key];
                const values = Array.isArray(rawVal) ? rawVal : [rawVal];
                if (values.length > 0) {
                    attrConditions.push({
                        $or: [
                            { [`atributos.${key}`]: { $in: values } },
                            { variants: { $elemMatch: { [`atributos.${key}`]: { $in: values } } } }
                        ]
                    });
                }
            });

            if (attrConditions.length > 0) matchStage.$and = attrConditions;

            pipeline.push({ $match: matchStage });

            // =================================================================
            // FASE 2: CAMPOS CALCULADOS PARA ORDENAMIENTO
            // =================================================================
            pipeline.push({
                $addFields: {
                    // Cálculo de descuento absoluto para el sort 'discount'
                    discountAmount: {
                        $cond: [
                            { $and: [{ $gt: ["$precioComparativo", 0] }, { $gt: ["$precioComparativo", "$precio"] }] },
                            { $subtract: ["$precioComparativo", "$precio"] },
                            0
                        ]
                    },
                    // Mantenemos el score de búsqueda si existe
                    searchScore: { $meta: "searchScore" }
                }
            });

            // =================================================================
            // FASE 3: DEFINICIÓN DE LÓGICA DE ORDENAMIENTO
            // =================================================================
            let sortStage: any = {};

            switch (sort) {
                case 'relevancia':
                    // Si hay query usa score, si no, usa destacados
                    sortStage = query ? { searchScore: -1 } : { esDestacado: -1, createdAt: -1 };
                    break;
                case 'recientes':
                    sortStage = { createdAt: -1 };
                    break;
                case 'rating':
                    sortStage = { rating: -1, numReviews: -1 };
                    break;
                case 'discount':
                    sortStage = { discountAmount: -1 };
                    break;
                case 'price-asc':
                    sortStage = { precio: 1 };
                    break;
                case 'price-desc':
                    sortStage = { precio: -1 };
                    break;
                case 'name-asc':
                    sortStage = { nombre: 1 };
                    break;
                default:
                    // Orden por defecto: Destacados y luego más recientes
                    sortStage = { esDestacado: -1, createdAt: -1 };
            }

            // =================================================================
            // FASE 4: FACETAS
            // =================================================================
            pipeline.push({
                $facet: {
                    products: [
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
                        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                        { $addFields: { lineObjectId: { $toObjectId: "$line" } } },
                        { $lookup: { from: 'lines', localField: 'lineObjectId', foreignField: '_id', as: 'line' } },
                        { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                nombre: 1, slug: 1, precio: 1, precioComparativo: 1,
                                imagenes: 1, stock: 1, atributos: 1, variants: 1,
                                brand: { nombre: 1, slug: 1 },
                                line: { nombre: 1, slug: 1 },
                                categoria: 1, esDestacado: 1, esNuevo: 1,
                                rating: 1, numReviews: 1, discountAmount: 1
                            }
                        }
                    ],
                    totalCount: [{ $count: 'count' }],
                    brands: [
                        { $group: { _id: "$brand" } },
                        { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "b" } },
                        { $unwind: "$b" },
                        { $project: { id: "$b._id", nombre: "$b.nombre", slug: "$b.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    lines: [
                        { $match: { line: { $exists: true, $ne: null } } },
                        { $group: { _id: "$line" } },
                        { $addFields: { lObj: { $toObjectId: "$_id" } } },
                        { $lookup: { from: "lines", localField: "lObj", foreignField: "_id", as: "l" } },
                        { $unwind: "$l" },
                        { $project: { id: "$l._id", nombre: "$l.nombre", slug: "$l.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    categories: [
                        { $group: { _id: "$categoria" } },
                        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "c" } },
                        { $unwind: "$c" },
                        { $project: { id: "$c._id", nombre: "$c.nombre", slug: "$c.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    atributos: [
                        {
                            $project: {
                                allAttrs: {
                                    $concatArrays: [
                                        { $objectToArray: { $ifNull: ["$atributos", {}] } },
                                        { $reduce: { input: { $ifNull: ["$variants", []] }, initialValue: [], in: { $concatArrays: ["$$value", { $objectToArray: { $ifNull: ["$$this.atributos", {}] } }] } } }
                                    ]
                                }
                            }
                        },
                        { $unwind: "$allAttrs" },
                        { $group: { _id: "$allAttrs.k", values: { $addToSet: "$allAttrs.v" } } },
                        { $project: { name: "$_id", values: 1, _id: 0 } }
                    ],
                    price: [
                        { $group: { _id: null, min: { $min: "$precio" }, max: { $max: "$precio" } } }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline);
            const data = result[0];
            const totalProducts = data.totalCount[0]?.count || 0;

            res.status(200).json({
                products: data.products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum) || 1,
                    totalItems: totalProducts
                },
                filters: {
                    brands: data.brands || [],
                    lines: data.lines || [],
                    categories: data.categories || [],
                    atributos: data.atributos || [],
                    price: data.price || []
                },
                context: {
                    categoryName: context.category ? (context.category as any).nombre : null,
                    brandName: context.brand ? (context.brand as any).nombre : null,
                    lineName: context.line ? (context.line as any).nombre : null,
                    searchQuery: query || null
                },
                isFallback: false
            });

        } catch (error: any) {
            console.error("Error en getCatalogBySlugs:", error);
            res.status(500).json({ message: error.message });
        }
    }

    // CONTROLADOR DE NOVEDADES (New Arrivals)
    // CONTROLADOR DE NOVEDADES (New Arrivals)
    static async getNewArrivals(req: Request, res: Response) {
        try {
            const { page, limit, sort, priceRange, ...attributeFilters } = req.query as any;

            const pageNum = Math.max(1, parseInt(page || "1", 10));
            const limitNum = Math.max(1, parseInt(limit || "24", 10));
            const skip = (pageNum - 1) * limitNum;

            // 1. DEFINIR "NOVEDAD"
            const daysAgo = new Date();
            daysAgo.setDate(daysAgo.getDate() - 45);

            const pipeline: any[] = [];

            // 2. FILTRO MAESTRO (MATCH)
            const matchStage: any = {
                isActive: true,
                $or: [
                    { esNuevo: true },
                    { createdAt: { $gte: daysAgo } }
                ]
            };

            // --- Filtro de Rango de Precio ---
            if (priceRange) {
                const [min, max] = priceRange.split('-').map(Number);
                if (!isNaN(min) && !isNaN(max)) {
                    matchStage.$and = matchStage.$and || [];
                    matchStage.$and.push({
                        $or: [
                            { precio: { $gte: min, $lte: max } },
                            { "variants.precio": { $gte: min, $lte: max } }
                        ]
                    });
                }
            }

            // --- Filtros de Atributos Dinámicos ---
            const attrConditions: any[] = [];
            const reservedKeys = ['limit', 'page', 'sort', 'priceRange'];

            Object.keys(attributeFilters).forEach((key) => {
                if (reservedKeys.includes(key)) return;
                const rawVal = attributeFilters[key];
                const values = Array.isArray(rawVal) ? rawVal : [rawVal];

                if (values.length > 0) {
                    attrConditions.push({
                        $or: [
                            { [`atributos.${key}`]: { $in: values } },
                            { "variants.atributos": { $elemMatch: { [key]: { $in: values } } } }
                        ]
                    });
                }
            });

            if (attrConditions.length > 0) {
                matchStage.$and = matchStage.$and || [];
                matchStage.$and.push(...attrConditions);
            }

            pipeline.push({ $match: matchStage });

            // 3. ORDENAMIENTO
            let sortStage: any = { createdAt: -1 };
            if (sort === 'price-asc') sortStage = { precio: 1 };
            if (sort === 'price-desc') sortStage = { precio: -1 };

            // 4. FACETAS (Estructura para CatalogResponseSchema)
            pipeline.push({
                $facet: {
                    products: [
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand' } },
                        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'productlines', localField: 'line', foreignField: '_id', as: 'line' } },
                        { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                nombre: 1, slug: 1, precio: 1, precioComparativo: 1,
                                imagenes: 1, stock: 1, atributos: 1, variants: 1,
                                brand: { nombre: 1, slug: 1 },
                                line: { nombre: 1, slug: 1 },
                                categoria: 1, esDestacado: 1, esNuevo: 1, createdAt: 1
                            }
                        }
                    ],
                    totalCount: [{ $count: 'count' }],
                    brands: [
                        { $group: { _id: "$brand" } },
                        { $match: { _id: { $ne: null } } },
                        { $lookup: { from: "brands", localField: "_id", foreignField: "_id", as: "b" } },
                        { $unwind: "$b" },
                        { $project: { id: { $toString: "$b._id" }, nombre: "$b.nombre", slug: "$b.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    lines: [
                        { $group: { _id: "$line" } },
                        { $match: { _id: { $ne: null } } },
                        { $lookup: { from: "productlines", localField: "_id", foreignField: "_id", as: "l" } },
                        { $unwind: "$l" },
                        { $project: { id: { $toString: "$l._id" }, nombre: "$l.nombre", slug: "$l.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    categories: [
                        { $group: { _id: "$categoria" } },
                        { $match: { _id: { $ne: null } } },
                        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "c" } },
                        { $unwind: "$c" },
                        { $project: { id: { $toString: "$c._id" }, nombre: "$c.nombre", slug: "$c.slug" } },
                        { $sort: { nombre: 1 } }
                    ],
                    atributos: [
                        {
                            $project: {
                                allAttrs: {
                                    $concatArrays: [
                                        { $objectToArray: { $ifNull: ["$atributos", {}] } },
                                        {
                                            $reduce: {
                                                input: { $ifNull: ["$variants", []] },
                                                initialValue: [],
                                                in: { $concatArrays: ["$$value", { $objectToArray: { $ifNull: ["$$this.atributos", {}] } }] }
                                            }
                                        }
                                    ]
                                }
                            }
                        },
                        { $unwind: "$allAttrs" },
                        { $group: { _id: "$allAttrs.k", values: { $addToSet: "$allAttrs.v" } } },
                        { $project: { name: "$_id", values: 1, _id: 0 } },
                        { $sort: { name: 1 } }
                    ],
                    priceRangeFacet: [
                        { $group: { _id: null, min: { $min: "$precio" }, max: { $max: "$precio" } } }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline);
            const data = result[0];
            const totalProducts = data.totalCount[0]?.count || 0;

            // Formatear respuesta según CatalogResponseSchema
            res.status(200).json({
                products: data.products,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalProducts / limitNum) || 1,
                    totalItems: totalProducts
                },
                filters: {
                    brands: data.brands || [],
                    lines: data.lines || [],
                    categories: data.categories || [],
                    atributos: data.atributos || [],
                    price: data.priceRangeFacet[0] ? [{ min: data.priceRangeFacet[0].min, max: data.priceRangeFacet[0].max }] : []
                },
                context: {
                    categoryName: "Lo Último",
                    brandName: null,
                    lineName: null,
                    searchQuery: null
                },
                isFallback: false
            });

        } catch (error: any) {
            console.error("Error en getNewArrivals:", error);
            res.status(500).json({ message: error.message });
        }
    }

}