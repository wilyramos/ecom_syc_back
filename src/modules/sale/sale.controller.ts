/* File: backend/src/modules/sale/sale.controller.ts */
import { RequestHandler } from 'express';
import { Sale } from '../../models/Sale';
import { TicketService } from './ticket.service';
import { PdfService } from './pdf.service';
import { SaleService } from './sale.service';
const saleService = new SaleService();

const ticketService = new TicketService();
const pdfService = new PdfService();         // <-- Instanciar


/**
 * GENERAR Y DESCARGAR PDF FORMATO A4
 */
export const downloadPdf: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate('items.product', 'nombre precio variants')
      .populate('employee', 'nombre apellidos');

    if (!sale) {
      res.status(404).json({ message: 'Documento no encontrado' });
      return;
    }

    const pdfBuffer = await pdfService.generateA4Buffer(sale);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="documento-${sale.receiptNumber || id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error('PDF A4 Generation Error:', error);
    res.status(500).json({ message: 'Error al generar el documento PDF A4' });
  }
};

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
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 10,
      search: req.query.search as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as string,
      cashShiftId: req.query.cashShiftId as string,
    };

    console.log("\n[BACKEND: getSales] Ejecutando con filtros:", filters);

    const result = await saleService.getSaleHistory(filters);
    res.status(200).json({ success: true, ...result });
  } catch (error: unknown) {
    console.error("\n💥 [BACKEND CRITICAL ERROR en getSales]:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
    }
    const message = error instanceof Error ? error.message : "Error desconocido en getSales";
    res.status(500).json({ success: false, message, detail: String(error) });
  }
};

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

export const exportSalesReport: RequestHandler = async (req, res) => {
  try {
    const salesData = await saleService.getSaleHistory({
      ...req.query,
      limit: 5000,
      page: 1
    });

    let csv = 'Fecha,Comprobante,Cliente,Documento,Metodo,Total,Estado\n';
    salesData.sales.forEach((s: any) => {
      const fecha = s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '';
      const cliente = s.customerSnapshot?.nombre || 'Cliente Varios';
      const doc = s.customerSnapshot?.numeroDocumento || '-';
      csv += `"${fecha}","${s.receiptNumber}","${cliente}","${doc}","${s.paymentMethod}",${s.totalPrice},"${s.status}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte-ventas.csv');
    res.status(200).send(csv);
  } catch (error: unknown) {
    res.status(500).json({ message: 'Error al exportar reporte' });
  }
};

export const getQuotes: RequestHandler = async (_req, res) => {
  try {
    const quotes = await saleService.getQuotes();
    res.status(200).json({ success: true, quotes });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: 'Error al obtener proformas' });
  }
};

export const downloadTicket: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id)
      .populate('items.product', 'nombre precio variants')
      .populate('employee', 'nombre');

    if (!sale) {
      res.status(404).json({ message: 'Documento no encontrado' });
      return;
    }

    const pdfBuffer = await ticketService.generateTicketBuffer(sale);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `inline; filename="ticket-${sale.receiptNumber || id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: unknown) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ message: 'Error al generar el PDF del ticket' });
  }
};

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al anular la venta';
    res.status(400).json({ success: false, message });
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al consultar la venta';
    res.status(400).json({ success: false, message });
  }
};