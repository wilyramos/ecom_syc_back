import { Request, Response, RequestHandler } from 'express';
import { ReportService } from './report.service';

const reportService = new ReportService();

export const getDashboardStats: RequestHandler = async (req, res) => {
    try {
        const period = (req.query.period as string) || 'today';
        const stats = await reportService.getStats(period);
        
        res.status(200).json(stats);
    } catch (error: any) {
        console.error("Error en Dashboard Stats:", error);
        res.status(500).json({ 
            success: false, 
            message: "Error al calcular métricas de negocio" 
        });
    }
};