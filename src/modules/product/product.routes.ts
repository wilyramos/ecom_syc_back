import { Router } from 'express';
import { 
    getPosProducts, 
    getByBarcode, 
    getAllProducts, 
    saveProduct, 
    updateStock, 
    deleteProduct,
    toggleStatus,
    getBatchByIds,
    searchProducts
} from './product.controller';

const router = Router();

// Rutas para el POS
router.get('/pos', getPosProducts);
router.get('/barcode/:code', getByBarcode);
router.post('/batch', getBatchByIds);

// Rutas para el admin 

// buscar productos
router.get('/search', searchProducts);

// Rutas Administrativas (Inventario)
router.get('/', getAllProducts);
router.post('/', saveProduct); // Crear
router.put('/:id', saveProduct); // Editar
router.patch('/:id/stock', updateStock);
router.patch('/:id/status', toggleStatus);
router.delete('/:id', deleteProduct);




export default router;