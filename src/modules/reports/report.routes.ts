import { Router } from 'express';
import { getDashboardStats } from './report.controller'; // Ajusta la ruta de importación
// Nota: Si creaste una carpeta módulos/report, sería:
// import { getDashboardStats } from '../modules/reports/report.controller';

const router = Router();

// Endpoint: GET /api/reports/v2/stats
router.get('/stats', getDashboardStats);

export default router;