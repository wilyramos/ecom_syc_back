import { Router } from 'express';
import { getStatus, open, close, addMovement, getSummary, getMovements } from './cash.controller';

const router = Router();

router.get('/status', getStatus);
router.post('/open', open);
router.post('/movement', addMovement);
router.post('/close', close);

router.get('/summary/:shiftId', getSummary);

router.get('/movements/:shiftId', getMovements);
export default router;