/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Operaciones de autenticación y registro
 *   - name: Products
 *     description: Gestión de productos del catálogo
 *   - name: Categories
 *     description: Gestión de categorías
 *   - name: Brands
 *     description: Gestión de marcas
 *   - name: Cart
 *     description: Gestión del carrito de compras
 *   - name: Orders
 *     description: Gestión de pedidos
 *   - name: Checkout
 *     description: Proceso de compra
 *   - name: Users
 *     description: Gestión de usuarios
 *   - name: Sales
 *     description: Gestión de ventas
 *   - name: Reports
 *     description: Reportes y estadísticas
 *   - name: Cash
 *     description: Gestión de caja
 */

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     description: Crea una nueva cuenta de usuario en la plataforma
 *     tags:
 *       - Authentication
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SecurePass123!
 *               firstName:
 *                 type: string
 *                 minLength: 2
 *                 example: John
 *               lastName:
 *                 type: string
 *                 minLength: 2
 *                 example: Doe
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validación fallida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: El usuario ya existe
 *
 * /api/v1/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: Autentica un usuario y retorna un JWT token
 *     tags:
 *       - Authentication
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Email o contraseña requeridos
 *       401:
 *         description: Credenciales inválidas
 *
 * /api/v1/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags:
 *       - Authentication
 *     responses:
 *       200:
 *         description: Sesión cerrada
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v2/products:
 *   get:
 *     summary: Obtener lista de productos
 *     description: Retorna una lista paginada de productos con opciones de filtrado
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad de elementos por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nombre o descripción
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoría
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filtrar por marca
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Precio mínimo
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Precio máximo
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Ordenar por precio
 *     responses:
 *       200:
 *         description: Lista de productos obtenida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       400:
 *         description: Parámetros inválidos
 *       500:
 *         description: Error del servidor
 *
 *   post:
 *     summary: Crear nuevo producto
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 format: float
 *                 minimum: 0.01
 *               category:
 *                 type: string
 *               brand:
 *                 type: string
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *               image:
 *                 type: string
 *                 format: url
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Validación fallida
 *       401:
 *         description: No autorizado
 *
 * /api/v2/products/{id}:
 *   get:
 *     summary: Obtener producto por ID
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto
 *     responses:
 *       200:
 *         description: Producto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Producto no encontrado
 *
 *   put:
 *     summary: Actualizar producto
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Producto no encontrado
 *
 *   delete:
 *     summary: Eliminar producto
 *     tags:
 *       - Products
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Producto eliminado
 *       404:
 *         description: Producto no encontrado
 */

/**
 * @swagger
 * /api/v1/category:
 *   get:
 *     summary: Obtener todas las categorías
 *     tags:
 *       - Categories
 *     responses:
 *       200:
 *         description: Lista de categorías
 *
 *   post:
 *     summary: Crear nueva categoría
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Categoría creada
 *       400:
 *         description: Validación fallida
 */

/**
 * @swagger
 * /api/v1/brands:
 *   get:
 *     summary: Obtener todas las marcas
 *     tags:
 *       - Brands
 *     responses:
 *       200:
 *         description: Lista de marcas
 *
 *   post:
 *     summary: Crear nueva marca
 *     tags:
 *       - Brands
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               logo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Marca creada
 */

/**
 * @swagger
 * /api/v1/cart:
 *   get:
 *     summary: Obtener carrito del usuario
 *     tags:
 *       - Cart
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Carrito obtenido
 *       401:
 *         description: No autorizado
 *
 *   post:
 *     summary: Agregar producto al carrito
 *     tags:
 *       - Cart
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Producto agregado
 *       401:
 *         description: No autorizado
 *
 *   delete:
 *     summary: Vaciar carrito
 *     tags:
 *       - Cart
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Carrito vaciado
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Obtener mis pedidos
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, cancelled]
 *     responses:
 *       200:
 *         description: Pedidos obtenidos
 *       401:
 *         description: No autorizado
 *
 *   post:
 *     summary: Crear nuevo pedido
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Pedido creado
 *       400:
 *         description: Validación fallida
 *
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Obtener pedido por ID
 *     tags:
 *       - Orders
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *       404:
 *         description: Pedido no encontrado
 */

/**
 * @swagger
 * /api/v1/checkout:
 *   post:
 *     summary: Procesar pago
 *     tags:
 *       - Checkout
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethod
 *             properties:
 *               amount:
 *                 type: number
 *               paymentMethod:
 *                 type: string
 *                 enum: [credit_card, debit_card, paypal, bank_transfer]
 *               cardDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Pago procesado exitosamente
 *       400:
 *         description: Error en el pago
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Obtener perfil de usuario
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 *
 *   put:
 *     summary: Actualizar perfil de usuario
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       400:
 *         description: Validación fallida
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v2/sales:
 *   get:
 *     summary: Obtener todas las ventas
 *     tags:
 *       - Sales
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de ventas
 *       401:
 *         description: No autorizado
 *
 *   post:
 *     summary: Registrar nueva venta
 *     tags:
 *       - Sales
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Venta registrada
 *       400:
 *         description: Validación fallida
 */

/**
 * @swagger
 * /api/v2/reports:
 *   get:
 *     summary: Obtener reportes
 *     tags:
 *       - Reports
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sales, revenue, products, users]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Reporte generado
 *       401:
 *         description: No autorizado
 */

/**
 * @swagger
 * /api/v2/cash:
 *   get:
 *     summary: Obtener registro de caja
 *     tags:
 *       - Cash
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Registro de caja
 *       401:
 *         description: No autorizado
 *
 *   post:
 *     summary: Registrar movimiento de caja
 *     tags:
 *       - Cash
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Movimiento registrado
 *       400:
 *         description: Validación fallida
 */

export {}