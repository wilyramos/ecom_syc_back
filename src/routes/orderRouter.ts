import { Router } from 'express';
import { body, param } from 'express-validator';
import { OrderController } from '../controllers/OrderController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';
import { OrderStatus } from '../models/Order';

const router = Router();

/** * RUTAS PARA CLIENTES AUTENTICADOS 
 */

// Crear Orden
router.post('/',
    authenticate,
    OrderController.createOrder
);

// Obtener mis órdenes (Historial del cliente)
// Nota: Se coloca antes de /:id para evitar que "user" sea tomado como un ID
router.get('/user/me',
    authenticate,
    OrderController.getOrdersByUser
);

// Obtener detalle de una orden por ID (Admin o Dueño de la orden)
router.get('/:id',
    authenticate,
    param('id').isMongoId().withMessage('ID no válido'),
    handleInputErrors,
    OrderController.getOrderById
);


/** * RUTAS DE ADMINISTRACIÓN (SOLO ADMIN) 
 */

// Obtener todas las órdenes con filtros y paginación
router.get('/',
    authenticate,
    isAdmin,
    OrderController.getOrders
);

// Actualizar Estado de la Orden
// Usamos PATCH para actualizar solo el campo status e historial
router.patch('/:id/status',
    authenticate,
    isAdmin,
    param('id').isMongoId().withMessage('ID no válido'),
    body('status')
        .notEmpty().withMessage('El estado es obligatorio')
        .isIn(Object.values(OrderStatus)).withMessage('Estado de orden no permitido'),
    handleInputErrors,
    OrderController.updateOrderStatus
);


/** * REPORTES Y ANALÍTICA (SOLO ADMIN) 
 */

router.get('/reports/sales-summary',
    authenticate,
    isAdmin,
    OrderController.getSummaryOrders
);

router.get('/reports/sales-over-time',
    authenticate,
    isAdmin,
    OrderController.getOrdersOverTime
);

router.get('/reports/orders-by-status',
    authenticate,
    isAdmin,
    OrderController.getReportOrdersByStatus
);

router.get('/reports/orders-by-payment-method',
    authenticate,
    isAdmin,
    OrderController.getReportOrdersByMethodPayment
);

router.get('/reports/orders-by-city',
    authenticate,
    isAdmin,
    OrderController.getReportOrdersByCity
);

router.get('/:id/pdf',
    // authenticate, //TODO:
    param('id').isMongoId().withMessage('ID no válido'),
    handleInputErrors,
    OrderController.generateOrderPDF
);

// Añade esta línea JUSTO DEBAJO de tu ruta de PDF anterior (rutas dinámicas)
router.get('/:id/shipping-label',
    // authenticate,
    // isAdmin, // Solo el admin/almacén debería imprimir etiquetas de envío
    param('id').isMongoId().withMessage('ID no válido'),
    handleInputErrors,
    OrderController.generateShippingLabelPDF
);

export default router;