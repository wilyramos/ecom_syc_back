import { Router } from 'express';
import { body, param } from 'express-validator';
import { validationResult } from 'express-validator';
import { handleInputErrors } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { CartController } from '../controllers/CartController';

const router = Router();

// get cart by userId
router.get('/',
    authenticate,
    CartController.getCart
);

// Clear cart
router.delete('/clear',
    authenticate,
    CartController.clearCart
);

// add product to cart
router.post('/',
    authenticate,
    body('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').optional().isNumeric().withMessage('Quantity must be a number'),
    body('quantity').optional().custom(value => value > 0).withMessage('Quantity must be greater than zero'),
    handleInputErrors,
    CartController.addProductToCart
);

// update Product Quantity
router.put('/:productId',
    authenticate,
    param('productId').notEmpty().withMessage('Product ID is required'),
    body('quantity').notEmpty().isNumeric().withMessage('Quantity is required and must be a number'),
    body('quantity').custom(value => value > 0).withMessage('Quantity must be greater than zero'),
    handleInputErrors,
    CartController.updateProductQuantity
);

// remove Product from Cart
router.delete('/:productId',
    authenticate,
    param('productId').notEmpty().withMessage('Product ID is required'),
    handleInputErrors,
    CartController.removeProductFromCart
);


export default router;