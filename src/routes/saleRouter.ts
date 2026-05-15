import { Router } from 'express';
import { body, param } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { SaleController } from '../controllers/SaleController';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';


const router = Router();

router.post('/',

    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe enviar al menos un producto'),
    body('items.*.product')
        .isMongoId()
        .withMessage('ID de producto inválido'),
    body('items.*.quantity')
        .isInt({ gt: 0 })
        .withMessage('La cantidad debe ser mayor a 0'),
    body('totalDiscountAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El descuento debe ser un número positivo'),
    body('paymentMethod')
        .optional()
        .isIn(['CASH', 'CARD', 'YAPE', 'PLIN', 'TRANSFER'])
        .withMessage('Método de pago inválido'),
    body('status')
        .optional()
        .isIn(['PENDING', 'COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELED'])
        .withMessage('Estado de venta inválido'),
    body('deliveryMethod')
        .optional()
        .isIn(['PICKUP', 'DELIVERY'])
        .withMessage('Método de entrega inválido'),
    authenticate,
    isAdminOrVendedor,
    handleInputErrors,
    SaleController.createSale,
);

// Endpoint para obtener una venta por ID
router.get('/:id',
    authenticate,
    isAdminOrVendedor,
    param('id').isMongoId().withMessage('ID de venta inválido'),
    handleInputErrors,
    SaleController.getSale,
);

// Endpoint para obtener ventas con filtros opcionales en el query

router.get('/',
    authenticate,
    isAdminOrVendedor,
    SaleController.getSales,
);

// Generar pdf
router.get('/:id/pdf',
    // authenticate,
    // isAdminOrVendedor,
    SaleController.getSalePdf,
);

// Endpoint para obtener una venta por ID
// router.get('/:id',
//     authenticate,
//     isAdminOrVendedor,
//     param('id').isMongoId().withMessage('ID de venta inválido'),
//     handleInputErrors,
//     // SaleController.getSaleById,
// );

// ****************//
// REPORTS
router.get('/report/metrics',
    // authenticate,
    // isAdminOrVendedor,
    SaleController.getSalesReport,
)

router.get('/report/summary',
    // authenticate,
    // isAdminOrVendedor,
    SaleController.getSalesSummary,
)

// GET TOP PRODUCTS
router.get('/report/top-products',
    // authenticate,
    // isAdminOrVendedor,
    SaleController.getTopProducts,
)

// GET REPORTS BY VENDORS

router.get("/report/vendors",
    // authenticate,
    // isAdminOrVendedor,
    SaleController.getReportByVendors,
)
    
export default router;