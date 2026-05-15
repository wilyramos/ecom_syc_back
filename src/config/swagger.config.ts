import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { Express } from 'express'
import path from 'path'

const getApiPaths = () => {
    const basePath = process.cwd()

    // Rutas específicas para tu estructura
    const apiPaths = [
        path.join(basePath, 'src/routes/**/*.ts'),
        path.join(basePath, 'src/routes/**/*.js'),
        path.join(basePath, 'src/modules/**/routes.ts'),
        path.join(basePath, 'src/modules/**/routes.js'),
        path.join(basePath, 'src/swagger.docs.ts'), 
    ]

    if (process.env.NODE_ENV === 'development') {
        console.log('[Swagger] Buscando documentación en:')
        apiPaths.forEach(p => {
            console.log(`   ✓ ${p}`)
        })
    }

    return apiPaths
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'E-Commerce API',
            version: '2.0.0',
            description: 'API REST completa para plataforma de e-commerce con Express, TypeScript y MongoDB',
            contact: {
                name: 'API Support',
                email: 'support@example.com'
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT'
            }
        },
        servers: [
            {
                url: process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`,
                description: 'Production Server'
            },
            {
                url: `http://localhost:${process.env.PORT || 4000}`,
                description: 'Development Server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT Authorization header usando Bearer scheme. Ej: Bearer eyJhbGciOiJIUzI1NiIs...'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false
                        },
                        message: {
                            type: 'string',
                            example: 'Error message'
                        },
                        statusCode: {
                            type: 'number',
                            example: 400
                        },
                        error: {
                            type: 'string'
                        }
                    }
                },
                PaginatedResponse: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: true
                        },
                        message: {
                            type: 'string'
                        },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object'
                            }
                        },
                        pagination: {
                            type: 'object',
                            properties: {
                                page: {
                                    type: 'number',
                                    example: 1
                                },
                                limit: {
                                    type: 'number',
                                    example: 10
                                },
                                total: {
                                    type: 'number',
                                    example: 100
                                },
                                pages: {
                                    type: 'number',
                                    example: 10
                                }
                            }
                        }
                    }
                },
                Product: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        name: {
                            type: 'string',
                            example: 'Laptop Dell XPS'
                        },
                        description: {
                            type: 'string',
                            example: 'Laptop de alta potencia para desarrollo'
                        },
                        price: {
                            type: 'number',
                            format: 'float',
                            example: 1299.99
                        },
                        category: {
                            type: 'string',
                            example: 'Electrónica'
                        },
                        brand: {
                            type: 'string',
                            example: 'Dell'
                        },
                        stock: {
                            type: 'integer',
                            example: 50
                        },
                        image: {
                            type: 'string',
                            format: 'url'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com'
                        },
                        firstName: {
                            type: 'string',
                            example: 'John'
                        },
                        lastName: {
                            type: 'string',
                            example: 'Doe'
                        },
                        role: {
                            type: 'string',
                            enum: ['user', 'admin'],
                            example: 'user'
                        },
                        phone: {
                            type: 'string'
                        },
                        address: {
                            type: 'string'
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        },
                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                },
                Order: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string'
                        },
                        user: {
                            type: 'string'
                        },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object'
                            }
                        },
                        totalPrice: {
                            type: 'number'
                        },
                        status: {
                            type: 'string',
                            enum: ['pending', 'completed', 'cancelled']
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        },
        security: [
            {
                BearerAuth: []
            }
        ]
    },
    apis: getApiPaths()
}

let specs: any = null

try {
    specs = swaggerJsdoc(options)
    const pathCount = Object.keys(specs.paths || {}).length

    if (process.env.NODE_ENV === 'development') {
        console.log(`[Swagger] Especificación generada correctamente`)
        console.log(`[Swagger] Total de endpoints: ${pathCount}`)

        if (pathCount === 0) {
            console.warn('[Swagger] NO se encontraron endpoints en la documentación')
            console.warn('[Swagger] Asegúrate de:')
            console.warn('   1. Tener comentarios @swagger en tus archivos')
            console.warn('   2. Haber creado src/swagger.docs.ts con las rutas')
            console.warn('   3. Que los archivos tengan extensión .ts o .js')
        }
    }
} catch (error) {
    console.error('[❌ Swagger] Error al generar especificación:', error)
    specs = {
        openapi: '3.0.0',
        info: { title: 'API', version: '1.0.0' },
        paths: {}
    }
}

export const setupSwagger = (app: Express) => {
    // Swagger UI
    app.use('/api-docs', swaggerUi.serve)
    app.get('/api-docs', swaggerUi.setup(specs, {
        swaggerOptions: {
            persistAuthorization: true,
            displayOperationId: false,
            filter: true,
            tryItOutEnabled: true,
            requestSnippetsEnabled: true,
            deepLinking: true
        },
        customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .model-box { display: none }
      .swagger-ui .models { display: none }
    `,
        customSiteTitle: 'E-Commerce API Documentation'
    }))

    // JSON endpoint
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.send(specs)
    })

    if (process.env.NODE_ENV === 'development') {
        console.log('[Swagger] Disponible en:')
        console.log(` UI: http://localhost:${process.env.PORT || 4000}/api-docs`)
        console.log(` JSON: http://localhost:${process.env.PORT || 4000}/api-docs.json`)
    }
}

export default setupSwagger