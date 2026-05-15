import { Router } from 'express';
import { authenticate, isAdminOrVendedor, isAdmin } from '../middleware/auth';
import { UserController } from '../controllers/UserController';

const router = Router();

// Listar usuarios (admin y vendedor)
router.get(
    '/',
    authenticate,
    isAdminOrVendedor,
    UserController.getAllUsers
);

// listar getAllClients
router.get(
    '/clients',
    authenticate,
    isAdminOrVendedor,
    UserController.getAllClients
);

// Actualizar rol (solo admin)
router.put(
    '/:id/role',
    authenticate,
    isAdmin,
    UserController.updateUserRole
);

// Actualizar contraseña de usuario (solo admin)
router.put(
    '/:id/password',
    authenticate,
    isAdmin,
    UserController.updateUserPassword
);

// TODO: Habilitar actualización de perfil por parte del usuario autenticado
// router.delete('/:id', authenticate, isAdmin, UserController.deleteUser);

export default router;
