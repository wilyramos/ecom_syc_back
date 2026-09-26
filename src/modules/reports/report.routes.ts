/* File: backend/src/modules/report/report.routes.ts */
import { Router } from 'express';
import { getDashboardStats } from './report.controller';

const router = Router();

// Endpoint: GET /api/reports/v2/stats?period=month&startDate=2024-01-01&endDate=2024-01-31
router.get('/stats', getDashboardStats);

export default router;