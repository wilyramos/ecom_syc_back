import { Router } from 'express';
import { body, query } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';
import { PurchaseController } from '../controllers/PurchaseController';


const router = Router();

router.post('/',
    body('proveedor').notEmpty().withMessage('Proveedor es requerido'),
    body('items').isArray({ min: 1 }).withMessage('Debe haber al menos un item en la compra'),

    handleInputErrors,
    // authenticate,
    // isAdminOrVendedor,
    PurchaseController.createPurchase
);

router.get('/',
   

    handleInputErrors,
    PurchaseController.getPurchases
);


router.get('/:id', PurchaseController.getPurchase);


export default router;