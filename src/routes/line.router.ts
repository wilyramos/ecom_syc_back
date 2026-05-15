//File: backend/src/routes/line.router.ts

import { Router } from 'express';
import { LineController } from '../controllers/line.controller';
import { authenticate, isAdmin, isAdminOrVendedor } from '../middleware/auth';
// import { authenticate, isAdmin } from '../middleware/auth'; // Asumiendo que tienes auth

const router = Router();

// Rutas Públicas (para el frontend)
router.get('/', LineController.getAll);
router.get('/slug/:slug', LineController.getBySlug);
router.get('/brand/:brandId', LineController.getByBrand);

// Rutas Privadas (Admin Panel)
// router.use(authenticate, isAdmin); 
router.post('/', authenticate, isAdminOrVendedor, LineController.create);
router.put('/:id', authenticate, isAdminOrVendedor, LineController.update);
router.delete('/:id', authenticate, isAdminOrVendedor, LineController.delete);

export default router;