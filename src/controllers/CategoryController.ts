import { Request, Response } from 'express';
import slugify from 'slugify';
import Category from '../models/Category';
import Product from '../models/Product';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';

export class CategoryController {
    static async createCategory(req: Request, res: Response) {
        try {
            let { nombre, descripcion, parent, attributes, image, isActive } = req.body;

            console.log("Attributes received:", attributes);

            if (parent === "null" || parent === "" || parent === undefined) {
                parent = null;
            }
            const slug = slugify(nombre, { lower: true, strict: true });

            const existing = await Category.findOne({ slug });
            if (existing) {
                res.status(400).json({ message: "La categoria ya existe" });
                return;
            }

            if (parent !== null) {
                const parentExists = await Category.findById(parent);
                if (!parentExists) {
                    res.status(400).json({ message: "La categoria padre no existe" });
                    return;
                }
            }


            if (attributes) {
                if (!Array.isArray(attributes)) {
                    res.status(400).json({ message: "Los atributos deben ser un array" });
                    return;
                }

                for (const attr of attributes) {
                    if (
                        !attr.name ||
                        !Array.isArray(attr.values) ||
                        attr.values.length === 0
                    ) {
                        res.status(400).json({
                            message: "Cada atributo debe tener un nombre y al menos un valor"
                        });
                        return;
                    }

                    if (attr.isVariant !== undefined && typeof attr.isVariant !== "boolean") {
                        res.status(400).json({
                            message: "El campo isVariant debe ser boolean"
                        });
                        return;
                    }
                }
            }

            const newCategory = new Category({
                nombre,
                descripcion,
                slug,
                parent: parent || null,
                image,
                isActive,
                attributes: attributes?.map(a => ({
                    name: a.name.trim(),
                    values: a.values.map(v => v.trim()),
                    isVariant: a.isVariant ?? false
                }))
            });

            await newCategory.save();
            res.status(201).json({ message: "Category created successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: "Error al crear la categoria" });
            return;
        }
    }

    static async getCategories(req: Request, res: Response) {
        try {
            const categories = await Category.find().select('_id nombre slug descripcion parent attributes variants image')
                .populate('parent', '_id nombre slug')
                .sort({ createdAt: -1 });
            // console.log('Categories:', categories);
            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorias' });
            return;
        }
    }
    static async getCategoryById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const category = await Category.findById(id)
                .select('_id nombre slug descripcion parent attributes variants image isActive')
                .populate('parent', '_id nombre slug');
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            // console.log('Category:', category);
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoria', error });
            return;
        }
    }

    static async getCategoryBySlug(req: Request, res: Response) {
        try {
            const { slug } = req.params;
            const category = await Category.findOne({ slug })
                .select('_id nombre slug descripcion parent attributes image isActive')
                .populate('parent', '_id nombre slug');

            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }
            res.status(200).json(category);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener la categoria', error });
            return;
        }
    }

    static async updateCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;
            let { nombre, descripcion, parent, attributes, image, isActive } = req.body;

            console.log("Attributes received:", attributes.isVariant);

            if (parent === "null" || parent === "" || parent === undefined) {
                parent = null;
            }

            const existing = await Category.findById(id);
            if (!existing) {
                res.status(404).json({ message: "Categoría no encontrada" });
                return;
            }

            const slug = slugify(nombre, { lower: true, strict: true });

            const existingSlug = await Category.findOne({ slug });
            if (existingSlug && existingSlug._id.toString() !== id) {
                res.status(400).json({ message: "El slug ya existe" });
                return;
            }

            if (parent !== null) {
                if (parent === id) {
                    res.status(400).json({
                        message: "No se puede establecer una categoría como su propio padre"
                    });
                    return;
                }

                const parentExists = await Category.findById(parent);
                if (!parentExists) {
                    res.status(400).json({ message: "La categoría padre no existe" });
                    return;
                }
            }

            if (attributes) {
                if (!Array.isArray(attributes)) {
                    res.status(400).json({ message: "Los atributos deben ser un array" });
                    return;
                }

                for (const attr of attributes) {
                    if (
                        !attr.name ||
                        !Array.isArray(attr.values) ||
                        attr.values.length === 0
                    ) {
                        res.status(400).json({
                            message: "Cada atributo debe tener un nombre y al menos un valor"
                        });
                        return;
                    }

                    if (attr.isVariant !== undefined && typeof attr.isVariant !== "boolean") {
                        res.status(400).json({
                            message: "El campo isVariant debe ser boolean"
                        });
                        return;
                    }
                }
            }

            const updated = await Category.findByIdAndUpdate(
                id,
                {
                    nombre,
                    descripcion,
                    slug,
                    parent,
                    attributes: attributes
                        ? attributes.map(a => ({
                            name: a.name.trim(),
                            values: a.values.map(v => v.trim()),
                            isVariant: a.isVariant ?? false
                        }))
                        : existing.attributes,
                    image: image ?? existing.image,
                    isActive: isActive !== undefined ? isActive : existing.isActive
                },
                { new: true }
            );

            if (!updated) {
                res.status(404).json({ message: "Categoría no encontrada" });
                return;
            }

            res.status(200).json({ message: "Categoría actualizada con éxito" });
        } catch (error) {
            res.status(500).json({ message: "Error al actualizar la categoría" });
            return;
        }
    }


    static async deleteCategory(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const productWithCategory = await Product.countDocuments({ categoria: id });

            // verificar si la categoria existe
            const existingCategory = await Category.findById(id);
            if (!existingCategory) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            // Verificar si la categoria tiene subcategorias
            const categoryWithSubcategories = await Category.countDocuments({ parent: id });
            if (categoryWithSubcategories > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene subcategorias asociadas' });
                return;
            }

            // Verificar si la categoria tiene productos asociados
            if (productWithCategory > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene productos asociados' });
                return;
            }


            // Verificar si la categoria tiene subcategorias
            const subcategories = await Category.countDocuments({ parent: id });
            if (subcategories > 0) {
                res.status(400).json({ message: 'No se puede eliminar la categoria porque tiene subcategorias asociadas' });
                return;
            }


            const category = await Category.findByIdAndDelete(id);
            if (!category) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            res.status(200).json({ message: 'Categoria eliminada con exito' });
        } catch (error) {
            // console.error(error);
            res.status(500).json({ message: 'Error al eliminar la categoria' });
            return;
        }
    }

    // Traer solo las categorias raiz
    static async getRootCategories(req: Request, res: Response) {
        try {

            const rootCategories = await Category.find({ parent: null })
                .select('_id nombre slug descripcion')
                .sort({ createdAt: -1 });

            if (rootCategories.length === 0) {
                res.status(404).json({ message: 'No se encontraron categorias raiz' });
                return;
            }

            res.status(200).json(rootCategories);


        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las categorias raiz' });
            return;
        }
    }

    // Traer las subcategorias de una categoria
    static async getSubcategories(req: Request, res: Response) {
        try {
            const { id } = req.params;

            // Verificar si la categoria existe
            const existingCategory = await Category.findById(id);
            if (!existingCategory) {
                res.status(404).json({ message: 'Categoria no encontrada' });
                return;
            }

            const subcategories = await Category.find({ parent: id })
                .select('_id nombre slug descripcion attributes')
                .sort({ createdAt: -1 });

            if (subcategories.length === 0) {
                res.status(404).json({ message: 'No se encontraron subcategorias' });
                return;
            }

            res.status(200).json(subcategories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las subcategorias' });
            return;
        }
    }

    // Traer todas las subcategorias pobladas
    static async getAllSubcategoriesPobladas(req: Request, res: Response) {
        try {
            // get only subcategoriesActive

            const categories = await Category.find({ parent: { $ne: null }, isActive: true })
                .select('_id nombre slug descripcion parent attributes image')
                .populate('parent', '_id nombre slug')
                .sort({ createdAt: -1 });

            if (categories.length === 0) {
                res.status(404).json({ message: 'No se encontraron subcategorias' });
                return;
            }

            res.status(200).json(categories);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener las subcategorias' });
            return;
        }
    }

    static async uploadCategoryImage(req: Request, res: Response) {
        try {
            const file = (req as any).file;
            if (!file) {
                res.status(400).json({ message: 'No file uploaded' });
                return;
            }

            const results = await cloudinary.uploader.upload(file.path, {
                folder: 'categories',
                public_id: uuid(),
                transformation: [
                    { width: 800, height: 600, crop: "limit" }
                ]
            });
            res.status(200).json({ image: results.secure_url });

        } catch (error) {
            res.status(500).json({ message: 'Error uploading file' });
            return;
        }
    }
}