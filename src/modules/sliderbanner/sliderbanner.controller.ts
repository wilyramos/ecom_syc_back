import { RequestHandler } from 'express';
import { SliderBannerService, sliderBannerService } from './sliderbanner.service';

export class SliderBannerController {
    constructor(private readonly service: SliderBannerService) {}

    // ── HELPERS ───────────────────────────────────────────────────────────────

    private parseBoolean(value: unknown): boolean | undefined {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return undefined;
    }

    private parsePositiveInt(value: unknown, fallback: number): number {
        const n = parseInt(value as string, 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    }

    // ── PUBLIC (STOREFRONT) ───────────────────────────────────────────────────

    getActive: RequestHandler = async (_req, res, next) => {
        try {
            const banners = await this.service.getActiveBanners();
            res.status(200).json({ success: true, data: banners });
        } catch (error) {
            next(error);
        }
    };

    // ── ADMIN ─────────────────────────────────────────────────────────────────

    getAll: RequestHandler = async (req, res, next) => {
        try {
            const result = await this.service.getAllForAdmin({
                page:     this.parsePositiveInt(req.query.page, 1),
                limit:    this.parsePositiveInt(req.query.limit, 10),
                isActive: this.parseBoolean(req.query.isActive),
                search:   req.query.search as string | undefined,
            });

            res.status(200).json({ success: true, ...result });
        } catch (error) {
            next(error);
        }
    };

    getById: RequestHandler = async (req, res, next) => {
        try {
            const banner = await this.service.getById(req.params.id);
            res.status(200).json({ success: true, data: banner });
        } catch (error) {
            next(error);
        }
    };

    create: RequestHandler = async (req, res, next) => {
        try {
            const banner = await this.service.create(req.body);
            res.status(201).json({ success: true, data: banner });
        } catch (error) {
            next(error);
        }
    };

    update: RequestHandler = async (req, res, next) => {
        try {
            const banner = await this.service.update(req.params.id, req.body);
            res.status(200).json({ success: true, data: banner });
        } catch (error) {
            next(error);
        }
    };

    delete: RequestHandler = async (req, res, next) => {
        try {
            await this.service.delete(req.params.id);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    };

    toggleActive: RequestHandler = async (req, res, next) => {
        try {
            const banner = await this.service.toggleActive(req.params.id);
            res.status(200).json({ success: true, data: banner });
        } catch (error) {
            next(error);
        }
    };

    reorder: RequestHandler = async (req, res, next) => {
        try {
            const { items } = req.body;

            if (!Array.isArray(items) || items.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'El cuerpo debe contener un array "items" no vacío',
                });
                return;
            }

            const isValid = items.every(
                (item) =>
                    item &&
                    typeof item.id === 'string' &&
                    item.id.trim() !== '' &&
                    typeof item.order === 'number',
            );

            if (!isValid) {
                res.status(400).json({
                    success: false,
                    message: 'Cada item debe tener el formato { id: string, order: number }',
                });
                return;
            }

            await this.service.reorderBanners(items);
            res.status(200).json({ success: true, message: 'Orden actualizado correctamente' });
        } catch (error) {
            next(error);
        }
    };
}

export const sliderBannerController = new SliderBannerController(sliderBannerService);