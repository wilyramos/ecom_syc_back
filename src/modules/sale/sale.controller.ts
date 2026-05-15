import { RequestHandler } from 'express';
import { SaleService } from './sale.service';
import { generateSaleTicket } from '../../utils/ticketGenerator';
import { Sale } from '../../models/Sale';

const saleService = new SaleService();

/**
 * PROCESAR VENTA REAL
 */
export const processSale: RequestHandler = async (req, res) => {
    try {
        const sale = await saleService.createSale(req.body);
        res.status(201).json({
            success: true,
            message: 'Venta procesada con éxito',
            receiptNumber: sale.receiptNumber,
            sale
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al procesar la venta';
        res.status(400).json({ success: false, message });
    }
};

/**
 * CREAR PROFORMA / PRESUPUESTO
 */
export const createQuote: RequestHandler = async (req, res) => {
    try {
        const quote = await saleService.createQuote(req.body);
        res.status(201).json({
            success: true,
            message: 'Proforma guardada con éxito',
            quote
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al crear proforma';
        res.status(400).json({ success: false, message });
    }
};

export const getSales: RequestHandler = async (req, res) => {
    try {
        const filters = {
            page: parseInt(req.query.page as string) || 1,
            limit: parseInt(req.query.limit as string) || 10,
            search: req.query.search as string,
            startDate: req.query.startDate as string,
            endDate: req.query.endDate as string,
            status: req.query.status as string,
            cashShiftId: req.query.cashShiftId as string,
        };

        const result = await saleService.getSaleHistory(filters);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error: unknown) {
        res.status(500).json({ success: false, message: 'Error al obtener historial' });
    }
};

/**
 * CONVERTIR PROFORMA A VENTA REAL
 */
export const convertQuote: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { employeeId, paymentMethod } = req.body;

        if (!employeeId) {
            res.status(400).json({ success: false, message: 'ID de empleado requerido' });
            return;
        }

        const sale = await saleService.convertQuoteToSale(id, employeeId, paymentMethod);
        res.status(200).json({
            success: true,
            message: 'Proforma convertida en venta con éxito',
            receiptNumber: sale.receiptNumber,
            sale
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al convertir proforma';
        res.status(400).json({ success: false, message });
    }
};

/**
 * OBTENER LISTADO DE VENTAS Y PROFORMAS
 */
export const exportSalesReport: RequestHandler = async (req, res) => {
    try {
        // Reutilizamos la lógica de filtros pero sin paginación
        const salesData = await saleService.getSaleHistory({
            ...req.query,
            limit: 5000, // Límite razonable para un reporte
            page: 1
        });

        const sales = salesData.sales;

        // Cabeceras del CSV
        let csv = 'Fecha,Comprobante,Cliente,Documento,Metodo,Total,Estado\n';

        sales.forEach((s: any) => {
            const fecha = s.createdAt.toISOString().split('T')[0];
            const cliente = s.customerSnapshot?.nombre || 'Cliente Varios';
            const doc = s.customerSnapshot?.numeroDocumento || '-';
            csv += `${fecha},${s.receiptNumber},${cliente},${doc},${s.paymentMethod},${s.totalPrice},${s.status}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=reporte-ventas.csv');
        res.status(200).send(csv);
    } catch (error) {
        res.status(500).json({ message: 'Error al exportar reporte' });
    }
};

export const getQuotes: RequestHandler = async (req, res) => {
    try {
        const quotes = await saleService.getQuotes();
        res.status(200).json({ success: true, quotes });
    } catch (error: unknown) {
        res.status(500).json({ success: false, message: 'Error al obtener proformas' });
    }
};

/**
 * GENERAR Y DESCARGAR TICKET PDF
 */
export const downloadTicket: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await Sale.findById(id)
            .populate('items.product', 'nombre precio')
            .populate('employee', 'nombre');

        if (!sale) {
            res.status(404).json({ message: 'Venta no encontrada' });
            return;
        }

        const pdfBuffer = await generateSaleTicket(sale);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=ticket-${sale.receiptNumber || 'quote'}.pdf`);
        res.send(pdfBuffer);
    } catch (error: unknown) {
        console.error("PDF Error:", error);
        res.status(500).json({ message: 'Error al generar el PDF del ticket' });
    }
};

// backend/src/modules/sale/sale.controller.ts

export const refundSale: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const refundedSale = await saleService.refundSale(id, reason || 'Anulación de venta');

        res.status(200).json({
            success: true,
            message: 'Venta anulada y stock restablecido',
            sale: refundedSale
        });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getById: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const sale = await saleService.getSaleById(id);
        if (!sale) {
            res.status(404).json({ success: false, message: 'Venta no encontrada' });
            return;
        }
        res.status(200).json({ success: true, sale });
    }
    catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};