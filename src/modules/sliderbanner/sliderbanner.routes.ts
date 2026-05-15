// File: backend/src/modules/sliderbanner/sliderbanner.routes.ts
import { Router } from 'express';
import { sliderBannerController } from './sliderbanner.controller';
import { authenticate, isAdmin } from '../../middleware/auth.middleware';

const router = Router();

router.get('/active', sliderBannerController.getActive);

// ─────────────────────────────────────────────────────────────
// RUTAS PRIVADAS (Panel Administrativo)
// ─────────────────────────────────────────────────────────────
router.use(authenticate, isAdmin);
router.get('/', sliderBannerController.getAll);
router.post('/', sliderBannerController.create);
router.patch('/reorder', sliderBannerController.reorder);
router.get('/:id', sliderBannerController.getById);
router.put('/:id', sliderBannerController.update);
router.patch('/:id/toggle', sliderBannerController.toggleActive);
router.delete('/:id', sliderBannerController.delete);

export default router;