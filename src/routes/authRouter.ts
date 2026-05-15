//File: backend/src/routes/authRouter.ts
import { Router } from 'express';
import { body, param } from 'express-validator';
import { AuthController } from '../controllers/AuthController';
import { handleInputErrors } from '../middleware/validation';
import { authenticate, isAdminOrVendedor } from '../middleware/auth';


const router = Router();

router.post('/register',
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    handleInputErrors,
    AuthController.register,
)

router.post('/login',
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password').notEmpty().withMessage('Contraseña es requerida'),
    handleInputErrors,
    AuthController.login,
)

// Login and register with Google
router.post('/google',
    body('credential').notEmpty().withMessage('Token de Google es requerido'),
    handleInputErrors,
    AuthController.loginWithGoogle,
)

router.post('/forgot-password',
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    handleInputErrors,
    AuthController.forgotPassword,
)

router.post('/update-password/:token',
    param('token').notEmpty().withMessage('Token es requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    handleInputErrors,
    AuthController.updatePasswordWithToken,
)

router.get('/user',
    authenticate,
    AuthController.getUser,
)

router.get('/validate-token/:token',
    param('token').notEmpty().withMessage('Token es requerido'),
    handleInputErrors,
    AuthController.validateToken,
)

// Create user if not exists
router.post('/create-user-if-not-exists',
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('nombre').notEmpty().withMessage('Nombre es requerido'),
    body('apellidos').optional().isString().withMessage('Apellidos deben ser una cadena de texto'),
    body('tipoDocumento').isIn(['DNI', 'RUC', 'CE']).withMessage('Tipo de documento inválido'),
    body('numeroDocumento').notEmpty().withMessage('Número de documento es requerido'),
    body('telefono').optional().isString().withMessage('Teléfono debe ser una cadena de texto'),
    handleInputErrors,
    isAdminOrVendedor,
    AuthController.createUserIfNotExists,
)

// Edit user profile
router.put('/edit-profile',
    authenticate,
    body('apellidos').optional().isString().withMessage('Apellidos deben ser una cadena de texto'),
    body('tipoDocumento').optional().isIn(['DNI', 'RUC', 'CE']).withMessage('Tipo de documento inválido'),
    body('numeroDocumento').optional().isString().withMessage('Número de documento debe ser una cadena de texto'),
    body('telefono').optional().isString().withMessage('Teléfono debe ser una cadena de texto'),
    handleInputErrors,
    AuthController.editUser,
)




export default router;