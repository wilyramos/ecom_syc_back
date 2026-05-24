import { Types } from 'mongoose';
import Collection, { ICollection, CollectionType } from './collection.model';
import Product from '../../models/Product';
import { generateUniqueSlug } from '../../utils/slug';

export interface GetAllFilters {
    isActive?: boolean;
    type?: CollectionType;
}

export interface GetProductsOptions {
    limit?: number;
    skip?: number;
}

export class CollectionService {

    // ─── CRUD ────────────────────────────────────────────────────────────────

    async create(data: Partial<ICollection>): Promise<ICollection> {
        this.validateAndCleanDates(data);

        const slug = await this.resolveSlug(data.slug || data.name || '');

        const collection = new Collection({
            name: data.name,
            slug,
            type: data.type,
            description: data.description,
            image: data.image,
            bannerImage: data.bannerImage,
            color: data.color,
            icon: data.icon,
            order: data.order ?? 0,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            badgeLabel: data.badgeLabel,
            badgeColor: data.badgeColor,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            isActive: data.isActive ?? true,
        });

        return collection.save();
    }

    async getAll(filters: GetAllFilters = {}): Promise<ICollection[]> {
        const query: Record<string, unknown> = { deletedAt: null };

        if (filters.isActive !== undefined) query.isActive = filters.isActive;
        if (filters.type) query.type = filters.type;

        return Collection.find(query).sort({ order: 1 }).lean();
    }

    async getById(id: string): Promise<ICollection | null> {
        return Collection.findOne({ _id: id, deletedAt: null });
    }

    async getBySlug(slug: string): Promise<ICollection | null> {
        // Consulta indexada ultra limpia
        const collection = await Collection.findOne({
            slug,
            isActive: true,
            deletedAt: null
        });

        if (!collection) return null;

        // La lógica temporal de expiración se resuelve de forma explícita en JS
        if (collection.type === 'promotion') {
            const now = new Date();
            const hasStarted = !collection.startsAt || collection.startsAt <= now;
            const hasNotEnded = !collection.endsAt || collection.endsAt >= now;

            if (!hasStarted || !hasNotEnded) return null;
        }

        return collection;
    }

    async update(id: string, data: Partial<ICollection>): Promise<ICollection | null> {
        const current = await Collection.findOne({ _id: id, deletedAt: null });
        if (!current) throw new Error('Collection not found or deleted');

        this.validateAndCleanDates(data, current);

        if (data.slug) {
            data.slug = await this.resolveSlug(data.slug, id);
        }

        return Collection.findOneAndUpdate(
            { _id: id, deletedAt: null },
            data,
            { new: true, runValidators: true }
        );
    }

    async softDelete(id: string): Promise<ICollection | null> {
        return Collection.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date(), isActive: false },
            { new: true }
        );
    }

    // ─── PROMOCIONES VIGENTES ────────────────────────────────────────────────

    async getActivePromotions(): Promise<ICollection[]> {
        const now = new Date();

        return Collection.find({
            type: 'promotion',
            isActive: true,
            deletedAt: null,
            startsAt: { $lte: now },
            endsAt: { $gte: now },
        }).sort({ order: 1 }).lean();
    }

    // ─── PRODUCTOS ───────────────────────────────────────────────────────────

    async addProducts(collectionId: string, productIds: string[]): Promise<void> {
        await Product.updateMany(
            { _id: { $in: productIds }, deletedAt: null },
            { $addToSet: { collections: new Types.ObjectId(collectionId) } }
        );
    }

    async removeProduct(collectionId: string, productId: string): Promise<void> {
        await Product.findOneAndUpdate(
            { _id: productId, deletedAt: null },
            { $pull: { collections: new Types.ObjectId(collectionId) } }
        );
    }

    async getProducts(
        collectionId: string,
        { limit = 20, skip = 0 }: GetProductsOptions = {}
    ): Promise<{ products: any[]; total: number }> {
        const filter = {
            collections: new Types.ObjectId(collectionId),
            isActive: true,
            deletedAt: null,
        };

        const [products, total] = await Promise.all([
            Product.find(filter)
                .select('nombre precio precioComparativo imagenes slug categoria stock esDestacado')
                .sort({ esDestacado: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(filter),
        ]);

        return { products, total };
    }

    // ─── AUXILIARES PRIVADOS ──────────────────────────────────────────────────

    private validateAndCleanDates(data: Partial<ICollection>, current?: ICollection): void {
        const type = data.type ?? current?.type;
        const startsAt = data.startsAt !== undefined ? data.startsAt : current?.startsAt;
        const endsAt = data.endsAt !== undefined ? data.endsAt : current?.endsAt;

        if (type === 'promotion' && startsAt && endsAt) {
            if (new Date(startsAt) >= new Date(endsAt)) {
                throw new Error('endsAt must be greater than startsAt');
            }
        }

        // Limpieza segura usando undefined para remover campos innecesarios en Mongoose
        if (type !== 'promotion' && data.type !== undefined) {
            data.startsAt = undefined;
            data.endsAt = undefined;
            data.badgeLabel = undefined;
            data.badgeColor = undefined;
        }
    }

    private async resolveSlug(source: string, excludeId?: string): Promise<string> {
        const baseSlug = await generateUniqueSlug(source);

        const query: Record<string, unknown> = {
            slug: new RegExp(`^${baseSlug}(-[0-9]+)?$`, 'i'),
            deletedAt: null,
        };
        if (excludeId) query._id = { $ne: excludeId };

        const existing = await Collection.find(query).select('slug').lean();
        if (existing.length === 0) return baseSlug;

        const max = Math.max(
            0,
            ...existing.map(c => {
                const match = c.slug.match(/-(\d+)$/);
                return match ? parseInt(match[1], 10) : 0;
            })
        );

        return `${baseSlug}-${max + 1}`;
    }
}