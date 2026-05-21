import { Request, Response } from 'express';
import { CollectionService } from './collection.service';

const collectionService = new CollectionService();

export const createCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const collection = await collectionService.create(req.body);
        res.status(201).json(collection);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getAllCollections = async (req: Request, res: Response): Promise<void> => {
    try {
        const { active } = req.query;
        const filter: { isActive?: boolean } = {};
        if (active !== undefined) filter.isActive = active === 'true';

        const collections = await collectionService.getAll(filter);
        res.status(200).json(collections);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCollectionBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const { slug } = req.params;
        const collection = await collectionService.getBySlug(slug);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 20;
        const page = parseInt(req.query.page as string) || 1;
        const skip = (page - 1) * limit;

        const products = await collectionService.getProducts(collection._id as string, limit, skip);
        const totalProducts = await collectionService.countProducts(collection._id as string);

        res.status(200).json({
            collection,
            products,
            pagination: {
                total: totalProducts,
                page,
                limit,
                pages: Math.ceil(totalProducts / limit)
            }
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const collection = await collectionService.update(id, req.body);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }
        res.status(200).json(collection);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const collection = await collectionService.softDelete(id);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Colección desactivada correctamente', collection });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const addProductsToCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { productIds } = req.body;
        if (!Array.isArray(productIds)) {
            res.status(400).json({ message: 'productIds debe ser un arreglo de strings' });
            return;
        }
        await collectionService.addProductsToCollection(id, productIds);
        res.status(200).json({ message: 'Productos vinculados a la colección con éxito' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const removeProductFromCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, productId } = req.params;
        await collectionService.removeProductFromCollection(id, productId);
        res.status(200).json({ message: 'Producto desvinculado de la colección con éxito' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};