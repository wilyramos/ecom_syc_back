import { Router } from 'express';
import {
    processSale,
    getSales,
    createQuote,
    convertQuote,
    getQuotes,
    downloadPdf,
    downloadTicket,
    refundSale,
    exportSalesReport,
    getById
} from './sale.controller';

const router = Router();

// --- OPERACIONES DE VENTA ---
router.post('/', processSale);           // Crear venta real
router.get('/', getSales);               // <-- Faltaba esta ruta para el listado/filtros
router.get('/export', exportSalesReport); // Reporte CSV
router.get('/:id/ticket', downloadTicket); // PDF
router.get('/:id/pdf', downloadPdf);       // <-- A4 Estándar (http://localhost:3000/api/sales/:id/pdf)
router.get('/:id', getById);
// --- OPERACIONES DE PROFORMAS ---
router.post('/quote', createQuote);
router.get('/quotes', getQuotes);
router.post('/:id/convert', convertQuote);
router.post('/:id/refund', refundSale);

export default router;