// File: backend/src/modules/collection/collection.controller.ts

import { Request, Response } from 'express';
import { CollectionService, GetAllFilters } from './collection.service';
import { COLLECTION_TYPES, CollectionType } from './collection.model';

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
        const filters: GetAllFilters = {};

        if (req.query.active !== undefined) {
            filters.isActive = req.query.active === 'true';
        }

        if (req.query.type) {
            const type = req.query.type as string;
            if (!COLLECTION_TYPES.includes(type as CollectionType)) {
                res.status(400).json({ message: `Tipo inválido. Valores permitidos: ${COLLECTION_TYPES.join(', ')}` });
                return;
            }
            filters.type = type as CollectionType;
        }

        const collections = await collectionService.getAll(filters);
        res.status(200).json(collections);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCollectionById = async (req: Request, res: Response): Promise<void> => {
    try {
        const collection = await collectionService.getById(req.params.id);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }
        res.status(200).json(collection);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCollectionBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
        const collection = await collectionService.getBySlug(req.params.slug);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const skip = (page - 1) * limit;

        const { products, total } = await collectionService.getProducts(
            collection._id as string,
            { limit, skip }
        );

        res.status(200).json({
            collection,
            products,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getActivePromotions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const promotions = await collectionService.getActivePromotions();
        res.status(200).json(promotions);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const collection = await collectionService.update(req.params.id, req.body);
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
        const collection = await collectionService.softDelete(req.params.id);
        if (!collection) {
            res.status(404).json({ message: 'Colección no encontrada' });
            return;
        }
        res.status(200).json({ message: 'Colección eliminada correctamente', collection });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const addProductsToCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        const { productIds } = req.body;
        if (!Array.isArray(productIds) || productIds.length === 0) {
            res.status(400).json({ message: 'productIds debe ser un arreglo no vacío' });
            return;
        }
        await collectionService.addProducts(req.params.id, productIds);
        res.status(200).json({ message: 'Productos vinculados correctamente' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const removeProductFromCollection = async (req: Request, res: Response): Promise<void> => {
    try {
        await collectionService.removeProduct(req.params.id, req.params.productId);
        res.status(200).json({ message: 'Producto desvinculado correctamente' });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getActiveCollections = async (_req: Request, res: Response): Promise<void> => {
    try {
        const collections = await collectionService.getAll({ isActive: true });
        res.status(200).json(collections);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getCollectionProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
        const page  = Math.max(parseInt(req.query.page  as string) || 1,  1);
        const skip  = (page - 1) * limit;

        const { products, total } = await collectionService.getProducts(
            req.params.id,
            { limit, skip }
        );

        res.status(200).json({
            products,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};