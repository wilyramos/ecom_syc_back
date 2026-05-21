import { Router } from 'express';
import {
    createCollection,
    getAllCollections,
    getCollectionBySlug,
    updateCollection,
    deleteCollection,
    addProductsToCollection,
    removeProductFromCollection
} from './collection.controller';

const router = Router();

// Rutas de administración de colecciones
router.get('/', getAllCollections);
router.post('/', createCollection);
router.put('/:id', updateCollection);
router.delete('/:id', deleteCollection);

// Rutas de cara al cliente / filtros
router.get('/:slug', getCollectionBySlug);

// Rutas para gestionar productos dentro de colecciones
router.post('/:id/products', addProductsToCollection);
router.delete('/:id/products/:productId', removeProductFromCollection);

export default router;