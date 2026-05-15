// File: backend/src/modules/sliderbanner/sliderbanner.service.ts

import { FilterQuery, Types, UpdateQuery } from 'mongoose';
import SliderBanner, { ISliderBanner } from './sliderbanner.model';
import { AppError } from '../../utils/AppError';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface GetAllAdminDto {
    page?: number;
    limit?: number;
    isActive?: boolean;
    contentType?: string;
    search?: string;
}

export interface ReorderItemDto {
    id: string;
    order: number;
}

export interface PaginatedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        pages: number;
    };
}

const POPULATE_FIELDS = [
    { path: 'product', select: 'nombre slug precio imagenes' },
    { path: 'brand', select: 'nombre logo slug' },
    { path: 'category', select: 'nombre slug' },
];

// ─────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────

export class SliderBannerService {
    private readonly model = SliderBanner;

    // ── HELPERS ──────────────────────────────────────────────────────────────

    private assertId(id: string): void {
        if (!Types.ObjectId.isValid(id)) {
            throw new AppError('ID inválido', 400);
        }
    }

    private validate(data: Partial<ISliderBanner>, isUpdate = false): void {
        // Campos requeridos solo en creación
        if (!isUpdate) {
            if (!data.destUrl) throw new AppError('destUrl es requerido', 400);
            if (!data.media?.imageUrl) throw new AppError('media.imageUrl es requerido', 400);
            if (!data.media?.altText) throw new AppError('media.altText es requerido', 400);
        }

        // Relaciones según contentType
        if (data.contentType === 'product' && !data.product) throw new AppError('Producto requerido para contentType=product', 400);
        if (data.contentType === 'brand' && !data.brand) throw new AppError('Marca requerida para contentType=brand', 400);
        if (data.contentType === 'category' && !data.category) throw new AppError('Categoría requerida para contentType=category', 400);

        // Precios: compare debe ser mayor que current
        if (data.price?.current !== undefined && data.price?.compare !== undefined) {
            if (data.price.compare < data.price.current) {
                throw new AppError('El precio de comparación debe ser mayor al actual', 400);
            }
        }

        // Schedule: endsAt debe ser posterior a startsAt
        if (data.schedule?.startsAt && data.schedule?.endsAt) {
            if (new Date(data.schedule.endsAt) <= new Date(data.schedule.startsAt)) {
                throw new AppError('La fecha de fin debe ser posterior a la de inicio', 400);
            }
        }

        // Countdown: endsAt debe ser una fecha futura (solo en creación)
        if (!isUpdate && data.countdown?.endsAt) {
            if (new Date(data.countdown.endsAt) <= new Date()) {
                throw new AppError('La fecha del countdown debe ser futura', 400);
            }
        }
    }

    /**
     * Elimina recursivamente las claves con valor undefined
     * para evitar sobreescrituras accidentales en updates parciales.
     */
    private sanitize(data: Record<string, any>): Record<string, any> {
        const clean: Record<string, any> = {};

        for (const key of Object.keys(data)) {
            const val = data[key];
            if (val === undefined) continue;

            if (
                val !== null &&
                typeof val === 'object' &&
                !Array.isArray(val) &&
                !(val instanceof Date)
            ) {
                const nested = this.sanitize(val);
                clean[key] = nested;
            } else {
                clean[key] = val;
            }
        }

        return clean;
    }

    /**
     * Filtro para excluir banners fuera de su ventana de programación.
     */
    private scheduleFilter(): FilterQuery<ISliderBanner> {
        const now = new Date();
        return {
            $and: [
                {
                    $or: [
                        { 'schedule.startsAt': { $exists: false } },
                        { 'schedule.startsAt': null },
                        { 'schedule.startsAt': { $lte: now } },
                    ],
                },
                {
                    $or: [
                        { 'schedule.endsAt': { $exists: false } },
                        { 'schedule.endsAt': null },
                        { 'schedule.endsAt': { $gte: now } },
                    ],
                },
            ],
        };
    }

    // ── PUBLIC (STOREFRONT) ───────────────────────────────────────────────────

    async getActiveBanners(): Promise<ISliderBanner[]> {
        return this.model
            .find({ isActive: true, ...this.scheduleFilter() })
            .sort({ order: 1, createdAt: -1 })
            .limit(20)
            .populate(POPULATE_FIELDS)
            .lean()
            .exec() as unknown as ISliderBanner[];
    }

    // ── ADMIN ─────────────────────────────────────────────────────────────────

    async getAllForAdmin(dto: GetAllAdminDto = {}): Promise<PaginatedResult<ISliderBanner>> {
        const { page = 1, limit = 10, isActive, contentType, search } = dto;

        const filter: FilterQuery<ISliderBanner> = {};

        if (typeof isActive === 'boolean') filter.isActive = isActive;
        if (contentType) filter.contentType = contentType;

        if (search?.trim()) {
            filter.$or = [
                { title: { $regex: search.trim(), $options: 'i' } },
                { subtitle: { $regex: search.trim(), $options: 'i' } },
                { description: { $regex: search.trim(), $options: 'i' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.model
                .find(filter)
                .sort({ order: 1, createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate(POPULATE_FIELDS)
                .lean()
                .exec(),
            this.model.countDocuments(filter),
        ]);

        return {
            data: data as unknown as ISliderBanner[],
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }

    async getById(id: string): Promise<ISliderBanner> {
        this.assertId(id);

        const banner = await this.model
            .findById(id)
            .populate(POPULATE_FIELDS)
            .lean()
            .exec();

        if (!banner) throw new AppError('Banner no encontrado', 404);

        return banner as unknown as ISliderBanner;
    }

    async create(data: Partial<ISliderBanner>): Promise<ISliderBanner> {
        this.validate(data);

        // Auto-asignar orden al final si no se especifica
        if (data.order === undefined) {
            const last = await this.model
                .findOne()
                .sort({ order: -1 })
                .select('order')
                .lean();
            data.order = last ? (last.order ?? 0) + 1 : 1;
        }

        const created = await this.model.create(data);
        return this.getById(created._id.toString());
    }

    async update(id: string, data: Partial<ISliderBanner>): Promise<ISliderBanner> {
        this.assertId(id);

        const existing = await this.model.findById(id).lean();
        if (!existing) throw new AppError('Banner no encontrado', 404);

        // Mezclar el estado actual con los cambios para validar el objeto completo
        const sanitized = this.sanitize(data as Record<string, any>);
        const merged = { ...existing, ...sanitized } as Partial<ISliderBanner>;
        this.validate(merged, true);

        const updated = await this.model
            .findByIdAndUpdate(id, { $set: sanitized }, { new: true, runValidators: true })
            .populate(POPULATE_FIELDS)
            .lean()
            .exec();

        if (!updated) throw new AppError('Banner no encontrado', 404);

        return updated as unknown as ISliderBanner;
    }

    async delete(id: string): Promise<void> {
        this.assertId(id);
        const deleted = await this.model.findByIdAndDelete(id);
        if (!deleted) throw new AppError('Banner no encontrado', 404);
    }

    async toggleActive(id: string): Promise<ISliderBanner> {
        this.assertId(id);

        const banner = await this.model.findById(id);
        if (!banner) throw new AppError('Banner no encontrado', 404);

        banner.isActive = !banner.isActive;
        await banner.save();

        return this.getById(id);
    }

    async reorderBanners(items: ReorderItemDto[]): Promise<void> {
        const ops = items
            .filter(({ id }) => Types.ObjectId.isValid(id))
            .map(({ id, order }) => ({
                updateOne: {
                    filter: { _id: new Types.ObjectId(id) },
                    update: { $set: { order } },
                },
            }));

        if (ops.length > 0) {
            await this.model.bulkWrite(ops);
        }
    }
}

export const sliderBannerService = new SliderBannerService();