import { Request, Response, NextFunction } from 'express';
import { LineService } from '../services/line.service';
import { CreateLineSchema, UpdateLineSchema } from '../schemas/line.schema';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/AppError';
import { IProductLine } from '../models/ProductLine';

export class LineController {

    /**
     * POST /api/lines
     */
    static create = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        // 1. Validación Zod
        const result = CreateLineSchema.safeParse(req.body);
        
        if (!result.success) {
            // Usamos .issues para evitar error de TS
            const errorMessage = result.error.issues.map(e => e.message).join(', ');
            return next(new AppError(`Datos inválidos: ${errorMessage}`, 400));
        }

        // 2. Servicio
        // Casteamos a 'unknown' luego a 'Partial<IProductLine>' para que TS acepte los strings como ObjectIds
        const newLine = await LineService.create(result.data as unknown as Partial<IProductLine>);

        // 3. Respuesta
        res.status(201).json({
            status: 'success',
            data: newLine
        });
    });

    /**
     * GET /api/lines
     */
    static getAll = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { limit, active, brand } = req.query;

        const isActive = active === 'true' ? true : active === 'false' ? false : undefined;
        const brandId = typeof brand === 'string' ? brand : undefined;
        const limitNum = Number(limit) || 100;

        const lines = await LineService.getAll(limitNum, isActive, brandId);

        res.status(200).json({
            status: 'success',
            results: lines.length,
            data: lines
        });
    });

    /**
     * GET /api/lines/slug/:slug
     */
    static getBySlug = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { slug } = req.params;
        const line = await LineService.getBySlug(slug);

        res.status(200).json({
            status: 'success',
            data: line
        });
    });

    /**
     * GET /api/lines/brand/:brandId
     */
    static getByBrand = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { brandId } = req.params;
        const lines = await LineService.getByBrand(brandId);

        res.status(200).json({
            status: 'success',
            results: lines.length,
            data: lines
        });
    });

    /**
     * PUT /api/lines/:id
     */
    static update = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        
        const result = UpdateLineSchema.safeParse(req.body);
        
        if (!result.success) {
            const errorMessage = result.error.issues.map(e => e.message).join(', ');
            return next(new AppError(`Datos inválidos: ${errorMessage}`, 400));
        }

        const updatedLine = await LineService.update(
            id, 
            result.data as unknown as Partial<IProductLine>
        );

        res.status(200).json({
            status: 'success',
            data: updatedLine
        });
    });

    /**
     * DELETE /api/lines/:id
     */
    static delete = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        
        await LineService.delete(id);

        res.status(200).json({
            status: 'success',
            message: 'Línea eliminada correctamente',
            data: null 
        });
    });
}