/* File: backend/src/modules/report/report.controller.ts */
import { RequestHandler } from 'express';
import { ReportService } from './report.service';

const reportService = new ReportService();

export const getDashboardStats: RequestHandler = async (req, res) => {
    try {
        const filters = {
            period: (req.query.period as string) || 'today',
            startDate: req.query.startDate as string,
            endDate: req.query.endDate as string,
        };

        const stats = await reportService.getStats(filters);

        res.status(200).json({ success: true, data: stats });
    } catch (error: unknown) {
        console.error("Error en Dashboard Stats:", error);
        res.status(500).json({
            success: false,
            message: "Error al calcular métricas de negocio",
            detail: error instanceof Error ? error.message : String(error)
        });
    }
};