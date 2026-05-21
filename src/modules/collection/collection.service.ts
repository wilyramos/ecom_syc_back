//File: collection.service.ts

import Collection, { ICollection } from './collection.model';
import Product from '../../models/Product';
import { generateUniqueSlug } from '../../utils/slug';

export class CollectionService {
    async create(data: Partial<ICollection>): Promise<ICollection> {
        const slug = data.slug
            ? await this.generateUniqueSlugForCollection(data.slug)
            : await this.generateUniqueSlugForCollection(data.name || '');

        const collection = new Collection({
            name: data.name,
            slug,
            description: data.description,
            image: data.image,
            color: data.color,
            icon: data.icon,
            order: data.order || 0,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            isActive: true
        });
        return await collection.save();
    }

    private async generateUniqueSlugForCollection(nombre: string): Promise<string> {
        const baseSlug = await generateUniqueSlug(nombre);
        const existingSlugs = await Collection.find({
            slug: new RegExp(`^${baseSlug}(-[0-9]+)?$`, 'i')
        }).select('slug');

        if (existingSlugs.length === 0) return baseSlug;

        const numbers = existingSlugs.map(c => {
            const match = c.slug.match(/-([0-9]+)$/);
            return match ? parseInt(match[1], 10) : 0;
        });

        const maxNumber = Math.max(...numbers, 0);
        return `${baseSlug}-${maxNumber + 1}`;
    }

    async getAll(filter: { isActive?: boolean } = {}): Promise<ICollection[]> {
        return await Collection.find(filter).sort({ order: 1 });
    }

    async getById(id: string): Promise<ICollection | null> {
        return await Collection.findById(id);
    }

    async getBySlug(slug: string): Promise<ICollection | null> {
        return await Collection.findOne({ slug, isActive: true });
    }

    async update(id: string, data: Partial<ICollection>): Promise<ICollection | null> {
        return await Collection.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    }

    async softDelete(id: string): Promise<ICollection | null> {
        return await Collection.findByIdAndUpdate(id, { isActive: false }, { new: true });
    }

    async addProductsToCollection(collectionId: string, productIds: string[]): Promise<void> {
        await Product.updateMany(
            { _id: { $in: productIds } },
            { $addToSet: { collections: collectionId } }
        );
    }

    async removeProductFromCollection(collectionId: string, productId: string): Promise<void> {
        await Product.findByIdAndUpdate(productId, { $pull: { collections: collectionId } });
    }

    async getProducts(collectionId: string, limit: number = 20, skip: number = 0): Promise<any[]> {
        return await Product.find({ collections: collectionId, isActive: true })
            .select('nombre precio imagenes slug categoria')
            .limit(limit)
            .skip(skip)
            .sort({ createdAt: -1 });
    }

    async countProducts(collectionId: string): Promise<number> {
        return await Product.countDocuments({ collections: collectionId, isActive: true });
    }
}