// backend/src/routes/categoryRouter.ts

import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import { CategoryController } from '../controllers/CategoryController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin } from '../middleware/auth';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// ─── Rutas estáticas PRIMERO (antes de cualquier /:id o /:slug) ───────────────

// GET /categories/roots
router.get('/roots', CategoryController.getRootCategories);

// GET /categories/subcategories (todas las subcategorías pobladas)
router.get('/subcategories', CategoryController.getAllSubcategoriesPobladas);

// GET /categories/slug/:slug
router.get('/slug/:slug', CategoryController.getCategoryBySlug);

// POST /categories/image (subir imagen)
router.post(
    '/image',
    authenticate,
    isAdmin,
    upload.single('image'),
    CategoryController.uploadCategoryImage
);

// ─── CRUD principal ───────────────────────────────────────────────────────────

// POST /categories/create
router.post(
    '/create',
    authenticate,
    isAdmin,
    body('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isString().withMessage('El nombre debe ser texto'),
    body('descripcion')
        .optional()
        .isString().withMessage('La descripción debe ser texto'),
    body('parent')
        .optional({ nullable: true })
        .isString().withMessage('El parent debe ser un ID válido'),
    body('image')
        .optional()
        .isString().withMessage('La imagen debe ser una URL (string)'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive debe ser booleano'),
    body('order')
        .optional()
        .isNumeric().withMessage('El orden debe ser un número'),
    body('attributes')
        .optional()
        .isArray().withMessage('Los atributos deben ser un arreglo'),
    body('attributes.*.name')
        .if(body('attributes').exists())
        .notEmpty().withMessage('Cada atributo debe tener un nombre'),
    body('attributes.*.values')
        .if(body('attributes').exists())
        .isArray({ min: 1 }).withMessage('Cada atributo debe tener al menos un valor'),
    handleInputErrors,
    CategoryController.createCategory
);

// GET /categories
router.get('/', CategoryController.getCategories);

// GET /categories/:id
router.get('/:id', CategoryController.getCategoryById);

// GET /categories/:id/subcategories
router.get('/:id/subcategories', CategoryController.getSubcategories);

// PUT /categories/update/:id
router.put(
    '/update/:id',
    authenticate,
    isAdmin,
    body('nombre')
        .notEmpty().withMessage('El nombre es requerido')
        .isString().withMessage('El nombre debe ser texto'),
    body('descripcion')
        .optional()
        .isString().withMessage('La descripción debe ser texto'),
    body('parent')
        .optional({ nullable: true })
        .isString().withMessage('El parent debe ser un ID válido'),
    body('image')
        .optional()
        .isString().withMessage('La imagen debe ser una URL (string)'),
    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive debe ser booleano'),
    body('order')
        .optional()
        .isNumeric().withMessage('El orden debe ser un número'),
    body('attributes')
        .optional()
        .isArray().withMessage('Los atributos deben ser un arreglo'),
    body('attributes.*.name')
        .if(body('attributes').exists())
        .notEmpty().withMessage('Cada atributo debe tener un nombre'),
    body('attributes.*.values')
        .if(body('attributes').exists())
        .isArray({ min: 1 }).withMessage('Cada atributo debe tener al menos un valor'),
    handleInputErrors,
    CategoryController.updateCategory
);

// DELETE /categories/:id
router.delete('/:id', authenticate, isAdmin, CategoryController.deleteCategory);

export default router;