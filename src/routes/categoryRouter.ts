import { Router } from 'express';
import { body } from 'express-validator';
import { CategoryController } from '../controllers/CategoryController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';


const router = Router();

router.post(
    "/create",
    authenticate,
    isAdmin,

    // Validaciones
    body("nombre")
        .notEmpty()
        .withMessage("Name is required"),

    body("descripcion")
        .notEmpty()
        .withMessage("Description is required"),

    body("image")
        .optional()
        .isString()
        .withMessage("Image must be a string (URL)"),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be a boolean"),

    body("attributes")
        .optional()
        .isArray()
        .withMessage("Attributes must be an array"),
    handleInputErrors,
    CategoryController.createCategory
);

router.get('/', CategoryController.getCategories);

// getCategoryByIdOrSlug
router.get('/:id', CategoryController.getCategoryById);
// getCategoryBySlug
router.get('/slug/:slug', CategoryController.getCategoryBySlug);
// updateCategory
router.put('/update/:id',
    authenticate, isAdmin,
    body('nombre').notEmpty().withMessage('Name is required'),
    body('descripcion').notEmpty().withMessage('Description is required'),
    handleInputErrors,
    CategoryController.updateCategory
);

// deleteCategory
router.delete('/:id', authenticate, isAdmin, CategoryController.deleteCategory);


// Traer todas las subcategorias

router.get('/all/onlysubcategories', CategoryController.getSubcategories);

// Traer todas las subcategorias pobladas
router.get('/all/subcategories', CategoryController.getAllSubcategoriesPobladas);

// Traer categorías raiz
router.get('/patterns/all', CategoryController.getRootCategories);


export default router;