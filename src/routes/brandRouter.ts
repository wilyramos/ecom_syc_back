import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';
import { BrandController } from '../controllers/BrandController';
import upload from '../middleware/upload';


const router = Router();

router.post('/',
    // authenticate, isAdmin,
    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    BrandController.createBrand,
)

router.get('/', BrandController.getBrands);

// Update brand

// uploadImage Cloudinary
router.post('/upload-image',
    authenticate, isAdmin,
    upload.single('file'),
    BrandController.uploadBrandImage
);


router.put('/:id',
    authenticate, isAdmin,
    param('id').isMongoId().withMessage('Invalid brand ID'),
    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    BrandController.updateBrand,
);

// get brand by slug
router.get('/slug/:slug', BrandController.getBrandBySlug);


router.get('/active', BrandController.getActiveBrands);


export default router;