// File: backend/src/modules/collection/collection.router.ts

import { Router } from 'express';
import {
    createCollection,
    getAllCollections,
    getCollectionById,
    getCollectionBySlug,
    getActivePromotions,
    updateCollection,
    deleteCollection,
    addProductsToCollection,
    removeProductFromCollection,
    getActiveCollections,
    getCollectionProducts
} from './collection.controller';
import { authorizeAdminOrVendedor } from '../../middleware/auth.middleware';

const router = Router();

// ─── RUTAS PÚBLICAS (CLIENTE ANÓNIMO / ACCESO LIBRE) ──────────────────────────
// Estas rutas no usan middleware de autenticación para garantizar la indexación SEO
router.get('/public/promotions',    getActivePromotions);
router.get('/public/active',        getActiveCollections); 
router.get('/public/:slug',         getCollectionBySlug);


// ─── RUTAS GESTIÓN COMERCIAL (RESTRINGIDAS: ADMIN Y VENDEDORES) ───────────────

// Listar colecciones con filtros masivos (soporta ver inactivas y eliminadas)
router.get('/', authorizeAdminOrVendedor, getAllCollections);

// Crear una nueva colección comercial
router.post('/', authorizeAdminOrVendedor, createCollection);

// Obtener detalles de configuración interna de una colección por su ID
router.get('/:id', authorizeAdminOrVendedor, getCollectionById);

// Actualizar campos o vigencia temporal de una colección
router.put('/:id', authorizeAdminOrVendedor, updateCollection);

// Eliminación lógica (Soft Delete)
router.delete('/:id', authorizeAdminOrVendedor, deleteCollection);


// ─── GESTIÓN DE PRODUCTOS (RESTRINGIDAS: ADMIN Y VENDEDORES) ──────────────────

// Vincular masivamente productos a una colección específica
router.post('/:id/products', authorizeAdminOrVendedor, addProductsToCollection);

// Remover un producto individual de la colección
router.delete('/:id/products/:productId', authorizeAdminOrVendedor, removeProductFromCollection);

router.get('/:id/products/list', authorizeAdminOrVendedor, getCollectionProducts);

export default router;