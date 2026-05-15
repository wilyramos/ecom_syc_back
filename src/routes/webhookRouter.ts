// File: backend/src/routes/webhookRouter.ts

import { Router } from 'express';
import { WebhookController } from '../controllers/webhookController';


const router = Router();

router.post('/mercadopago',

    WebhookController.handleWebHookMercadoPago  
);

router.post('/izipay',
    WebhookController.handleWebHookIzipay
)


export default router;