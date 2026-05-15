import { Router } from 'express';
import { body } from 'express-validator';
import {PaymentsController} from '../controllers/PaymentsController';
import { authenticate } from '../middleware/auth';


const router = Router();


// Mercadopago
router.post('/create-preference',
    authenticate,
    body('items').isArray().withMessage('Items must be an array'),
    PaymentsController.createPreference
);

router.post('/create-preference-orderid',
    authenticate,
    body('orderId').notEmpty().withMessage('Order ID is required'),
    PaymentsController.createPreferenceWithOrderId
);

// process payment mercadopago checkoutbriks
router.post('/process-payment',
    authenticate,
    body('formData').notEmpty().withMessage('Form data is required'),
    PaymentsController.processPayment
);

// Yape with mercadopago
router.post('/mercadopago/yape',
    authenticate,
    body('orderId').notEmpty().withMessage('Order ID is required'),
    PaymentsController.processPaymentYape
);

// api checkout mercadopago

router.post('/izipay/create-payment',
    // authenticate,
    PaymentsController.createPaymentIzipay
);



// Culqi

router.post('/process-payment-culqi',
    authenticate,
    // body('token').notEmpty().withMessage('Token is required'),
    // body('order').notEmpty().withMessage('Order is required'),
    PaymentsController.processPaymentCulqi
);

export default router;