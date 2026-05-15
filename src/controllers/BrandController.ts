import { Request, Response } from 'express';
import Brand from '../models/Brand';
import { v4 as uuid } from 'uuid';
import cloudinary from '../config/cloudinary';

export class BrandController {
    static async createBrand(req: Request, res: Response) {
        const { nombre, descripcion, logo } = req.body;

        console.log("Creating brand:", { nombre, descripcion, logo });
        try {
            const existingBrand = await Brand.findOne({ nombre });
            if (existingBrand) {
                res.status(400).json({ message: 'Brand name already exists' });
                return;
            }
            const slug = nombre.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

            const newBrand = new Brand({
                nombre,
                slug,
                descripcion,
                logo,
            });
            await newBrand.save();
            res.status(201).json(newBrand);
        } catch (error) {
            console.error('Error creating brand:', error);
            res.status(500).json({ message: 'Server error' });
            return;
        }
    }

    static async getBrands(req: Request, res: Response) {
        try {
            const brands = await Brand.find();
            res.status(200).json(brands)

        } catch (error) {
            console.error('Error fetching brands:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async getBrandById(req: Request, res: Response) {
        const { id } = req.params;
        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }
            res.status(200).json(brand);
        } catch (error) {
            console.error('Error fetching brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async getBrandBySlug(req: Request, res: Response) {
        const { slug } = req.params;
        try {
            const brand = await Brand.findOne({ slug });
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }
            res.status(200).json(brand);
        } catch (error) {
            console.error('Error fetching brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async updateBrand(req: Request, res: Response) {
        const { id } = req.params;
        const { nombre, descripcion, logo } = req.body;

        console.log("Updating brand:", { id, nombre, descripcion, logo });

        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }

            // Check for name uniqueness if changed
            if (nombre && nombre !== brand.nombre) {
                const existingBrand = await Brand.findOne({ nombre });
                if (existingBrand) {
                    res.status(400).json({ message: 'Brand name already exists' });
                    return;
                }
            }

            brand.nombre = nombre || brand.nombre;
            brand.descripcion = descripcion || brand.descripcion;
            brand.logo = logo || brand.logo;
            if (nombre) {
                brand.slug = nombre.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
            }
            await brand.save();

            res.status(200).json(brand);
        } catch (error) {
            console.error('Error updating brand:', error);
            res.status(500).json({ message: 'Error updating brand' });
        }
    }

    static async deleteBrand(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const brand = await Brand.findById(id);
            if (!brand) {
                res.status(404).json({ message: 'Brand not found' });
                return;
            }
            await brand.deleteOne();
            res.status(200).json({ message: 'Brand deleted' });
        } catch (error) {
            console.error('Error deleting brand:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }

    static async uploadBrandImage(req: Request, res: Response) {
        try {
            const file = (req as any).file;
            if (!file) {
                res.status(400).json({ message: 'No se recibió ningún archivo' });
                return;
            }

            const results = await cloudinary.uploader.upload(file.path, {
                folder: "brands",
                public_id: uuid(),
                transformation: [
                    { width: 500, height: 500, crop: "limit" }
                ]
            });
            console.log('Cloudinary upload result:', results);

            res.status(200).json({ message: 'Image uploaded successfully', image: results.secure_url });
        } catch (error) {
            console.error('Error deleting brand:', error);
            res.status(500).json({ message: 'Server error in uploading image' });
        }
    }

    static async getActiveBrands(req: Request, res: Response) {
        try {
            const brands = await Brand.find({ isActive: true });
            res.status(200).json(brands);
        } catch (error) {
            console.error('Error fetching active brands:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
}