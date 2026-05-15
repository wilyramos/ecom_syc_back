import { Router } from 'express';
import { body, query } from 'express-validator';
import { ProductController } from '../controllers/ProductController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdmin, isAdminOrVendedor } from '../middleware/auth';

const router = Router();

router.post(
    '/',
    authenticate,
    isAdmin,

    body('nombre')
        .notEmpty()
        .withMessage('Name is required'),

    body('descripcion')
        .optional()
        .isString()
        .withMessage('Description must be a string'),

    body('precio')
        .optional()
        .isNumeric()
        .withMessage('El precio debe ser un número')
        .custom(v => v >= 0)
        .withMessage('El precio debe ser cero o mayor'),

    body('precioComparativo')
        .optional()
        .isNumeric()
        .withMessage('El precio comparativo debe ser un número')
        .custom(v => v >= 0)
        .withMessage('El precio comparativo debe ser cero o mayor'),

    body('costo')
        .optional()
        .isNumeric()
        .withMessage('El costo debe ser un número')
        .custom(v => v >= 0)
        .withMessage('El costo debe ser cero o mayor'),

    body('imagenes')
        .optional()
        .isArray({ max: 5 })
        .withMessage('Las imágenes deben ser un arreglo con un máximo de 5 elementos'),

    body('categoria')
        .notEmpty()
        .withMessage('Category is required'),

    body('stock')
        .optional()
        .isNumeric()
        .withMessage('Stock must be a number')
        .custom(v => v >= 0)
        .withMessage('Stock must be zero or greater'),

    body('sku')
        .optional()
        .isString()
        .withMessage('SKU must be a string'),

    body('barcode')
        .optional()
        .isString()
        .withMessage('Barcode must be a string'),

    body('atributos')
        .optional()
        .isObject()
        .withMessage('Los atributos deben ser un objeto'),

    body('especificaciones')
        .optional()
        .isArray()
        .withMessage('Las especificaciones deben ser un arreglo'),

    body('variants')
        .optional()
        .isArray()
        .withMessage('Las variantes deben ser un arreglo'),

    body('variants.*.precio')
        .optional()
        .isNumeric()
        .withMessage('El precio de la variante debe ser numérico'),

    body('variants.*.precioComparativo')
        .optional()
        .isNumeric()
        .withMessage('El precio comparativo de la variante debe ser numérico'),

    body('variants.*.stock')
        .optional()
        .isNumeric()
        .withMessage('El stock de la variante debe ser numérico'),

    body('variants.*.atributos')
        .optional()
        .isObject()
        .withMessage('Los atributos de la variante deben ser un objeto'),

    handleInputErrors,
    ProductController.createProduct
);

// todo: generar un nuevo create con validacione y validar con el middleware

router.get('/', 
    authenticate,
    isAdminOrVendedor,
    ProductController.getProducts
);

// Get new products
router.get('/new', ProductController.getNewProducts);

// Search products by query
router.get('/search',
    body('query')
        .optional()
        .isString()
        .withMessage('Query must be a string'),
    body('page')
        .optional()
        .isNumeric()
        .withMessage('Page must be a number'),
    body('limit')
        .optional()
        .isNumeric()
        .withMessage('Limit must be a number'),
    handleInputErrors,
    ProductController.searchProducts
);

// Search products in index
router.get('/searchindex',
    query('query')
        .isString()
        .withMessage('Query must be a string'),
    handleInputErrors,
    ProductController.searchProductsIndex
);

// getProductsMainPage
router.get('/mainpage', ProductController.getProductsMainPage);

router.get('/catalog/resolve', ProductController.getCatalogBySlugs);

router.get('/offers/all', 

    ProductController.getOffers
);

router.get('/newarrivals/all', 

    ProductController.getNewArrivals
);

// get a list of products 

router.get('/list',
    
    ProductController.searchListProducts
);

router.get('/filter',

    body('page')
        .optional()
        .isNumeric()
        .withMessage('Page must be a number'),
    body('limit')
        .optional()
        .isNumeric()
        .withMessage('Limit must be a number'),
    body('category')
        .optional()
        .isString()
        .withMessage('Category must be a string'),
    body('priceRange')
        .optional()
        .isString()
        .withMessage('Price range must be a string'),
    handleInputErrors,
    ProductController.getProductsByFilter
);

router.get('/:id', ProductController.getProductById);

// Get products by SLUG
router.get('/slug/:slug', ProductController.getProductBySlug);

router.put('/:id',

    authenticate, isAdmin,
    ProductController.updateProduct
);

router.delete('/:id', authenticate, isAdmin, ProductController.deleteProduct);

//getProductsByCategory
router.get('/category/:categoryId',
    ProductController.getProductsByCategory);


router.get('/brand/:brandSlug', ProductController.getProductsByBrandSlug);


// router.get('/category/:categoryId', ProductController.getProductsByCategory);

// uploadImage Product
router.post('/:id/upload-images',
    authenticate, isAdmin,
    ProductController.uploadImagesToProduct
);

// uploadImage Cloudinary
router.post('/upload-images',
    authenticate, isAdmin,
    ProductController.uploadImageCloudinary
);

// Actualizar el estado de un producto
router.put('/:id/status',
    authenticate, isAdmin,
    body('isActive')
        .isBoolean()
        .withMessage('Status must be a boolean'),
    handleInputErrors,
    ProductController.updateProductStatus
);


// get product related products
router.get('/:slug/related', ProductController.getProductsRelated);

// get Traer los productos destacados
router.get('/destacados/all', ProductController.getDestacadosProducts);

// get all products for sitemap

router.get('/all/slug', ProductController.getAllProductsSlug);

// get products for front page
router.get('/frontpage/all', ProductController.getFrontPageProducts);

// Get all imanges from cloudinary
router.get('/imagesss/cloudinary/all', 
    authenticate, isAdmin,
    ProductController.getAllImagesFromCloudinary
);



export default router;  