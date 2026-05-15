import { Request, Response, RequestHandler } from 'express';
import { ProductService } from './product.service';

const productService = new ProductService();

/**
 * GET /api/products/v2
 */
export const getAllProducts: RequestHandler = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
        const search = (req.query.search as string) || "";

        const result = await productService.getAllProducts(page, limit, search);
        res.status(200).json({ success: true, ...result });
    } catch (error: any) {
        console.error("Controller Error (getAllProducts):", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/products/v2/pos
 */
export const getPosProducts: RequestHandler = async (req, res) => {
    try {
        const { q } = req.query;
        const products = await productService.getProductsForPos(q as string);
        res.status(200).json(products);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/products/v2/barcode/:code
 */
export const getByBarcode: RequestHandler = async (req, res) => {
    try {
        const { code } = req.params;
        const product = await productService.getProductByBarcode(code);
        
        if (!product) {
            res.status(404).json({ success: false, message: 'Producto no encontrado' });
            return;
        }
        res.status(200).json(product);
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST/PUT /api/products/v2/:id?
 */
export const saveProduct: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await productService.saveProduct(id, req.body);
        res.status(id ? 200 : 201).json({ success: true, product });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/products/v2/:id/stock
 */
export const updateStock: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { stock } = req.body;
        
        if (typeof stock !== 'number') {
            res.status(400).json({ success: false, message: 'Stock debe ser un número' });
            return;
        }

        await productService.updateStock(id, stock);
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * PATCH /api/products/v2/:id/status
 */
export const toggleStatus: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        await productService.toggleStatus(id, isActive);
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(400).json({ success: false });
    }
};

/**
 * DELETE /api/products/v2/:id
 */
export const deleteProduct: RequestHandler = async (req, res) => {
    try {
        await productService.deleteProduct(req.params.id);
        res.status(200).json({ success: true });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getBatchByIds: RequestHandler = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.some((id: any) => typeof id !== 'string')) {
            res.status(400).json({ success: false, message: 'IDs deben ser un array de strings' });
            return;
        }

        const products = await productService.getProductsByIds(ids);
        res.status(200).json({ success: true, products });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const searchProducts: RequestHandler = async (req, res) => {
    try {
        const { q } = req.query;
        const products = await productService.searchProducts(q as string);
        console.log("Controller Search Query:", q, "Results:", products);
        res.status(200).json({ success: true, products });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
}
   
            