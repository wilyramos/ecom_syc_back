/* File: backend/src/modules/report/report.service.ts */
import { Sale, SaleStatus } from "../../models/Sale";
import Product from "../../models/Product";

export interface ReportFilters {
    period?: string;
    startDate?: string;
    endDate?: string;
}

export class ReportService {
    async getStats(filters: ReportFilters) {
        // 1. Obtener el rango de fechas con exactitud para la zona horaria de Perú (-05:00)
        const { start, end } = this.getPeruDateRange(filters);

        // Filtro base para las ventas (Solo completadas y dentro del rango de Perú)
        const matchStage = {
            createdAt: { $gte: start,$lte: end },
            status: SaleStatus.COMPLETED
        };

        // 2. Ejecutar todas las agregaciones pesadas en paralelo
        const [globalData, chartData, topProducts, inventoryData] = await Promise.all([
            
            // A. KPIs GLOBALES Y MÉTODOS DE PAGO (DONUT)
            Sale.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totalPrice" },
                        totalOrders: { $sum: 1 },
                        // Total de unidades (sumando las cantidades del carrito)
                        totalUnits: { 
                            $sum: { $sum: "$items.quantity" } 
                        },
                        // Utilidad Neta = Suma de (Precio de Venta - Costo) * Cantidad
                        netProfit: { 
                            $sum: {$reduce: {
                                    input: "$items",
                                    initialValue: 0,
                                    in: { 
                                        $add: [                                             "$$value", 
                                            { $multiply: [{ $subtract: ["$$this.price", "$$this.cost"] }, "$$this.quantity"] }
                                        ] 
                                    }
                                }
                            }
                        },
                        // Recolectar métodos de pago para procesar en Node
                        methods: { $push: { method: "$paymentMethod", amount: "$totalPrice" } }
                    }
                }
            ]),

            // B. GRÁFICO DE BARRAS/LÍNEAS (VENTAS POR DÍA)
            Sale.aggregate([
                { $match: matchStage },
                {
                    $group: {
                        // Agrupar forzando el Timezone de Lima (-05:00) 
                        _id: { $dateToString: { format: "\%Y-\%m-\%d", date: "$createdAt", timezone: "-05:00" } },
                        total: { $sum: "$totalPrice" },
                        orders: { $sum: 1 }                     }                 },                 {$sort: { _id: 1 } } // Ordenar cronológicamente (más antiguo a más reciente)
            ]),

            // C. TOP 10 PRODUCTOS MÁS VENDIDOS
            Sale.aggregate([
                { $match: matchStage },
                { $unwind: "$items" }, // Separar el carrito en documentos individuales
                {
                    $group: {
                        _id: "$items.product",
                        soldUnits: { $sum: "$items.quantity" },
                        revenue: { $sum: {$multiply: ["$items.price", "$items.quantity"] } }
                    }
                },
                { $sort: { soldUnits: -1 } }, // Ordenar descendentemente por unidades
                { $limit: 10 },               // Top 10
                // Traer información del producto (JOIN)
                { 
                    $lookup: { 
                        from: "products", 
                        localField: "_id", 
                        foreignField: "_id", 
                        as: "productDetails" 
                    } 
                },
                { $unwind: "$productDetails" },
                {
                    $project: {
                        _id: 1,
                        name: "$productDetails.nombre",
                        image: { $arrayElemAt: ["$productDetails.imagenes", 0] },
                        soldUnits: 1,
                        revenue: 1
                    }
                }
            ]),

            // D. VALOR DE INVENTARIO Y ALERTAS (No depende de la fecha, es el estado actual)
            Product.aggregate([
                { $match: { isActive: true } },
                {
                    $group: {
                        _id: null,
                        // Multiplica el costo de cada producto por su stock actual
                        inventoryValue: { $sum: {$multiply: [{ $ifNull: ["$costo", 0] }, { $ifNull: ["$stock", 0] }] } },
                        // Cuenta cuántos productos tienen stock bajo (ej. <= 5 unidades)
                        lowStockCount: { $sum: {$cond: [{ $lte: ["$stock", 5] }, 1, 0] } }
                    }
                }
            ])
        ]);

        // 3. Formatear resultados
        const stats = globalData[0] || { totalSales: 0, totalOrders: 0, totalUnits: 0, netProfit: 0, methods: [] };
        const inventory = inventoryData[0] || { inventoryValue: 0, lowStockCount: 0 };

        return {
            summary: {
                totalSales: stats.totalSales,
                totalOrders: stats.totalOrders,
                totalUnits: stats.totalUnits,
                netProfit: stats.netProfit,
                inventoryValue: inventory.inventoryValue,
                lowStockCount: inventory.lowStockCount,
            },
            salesByMethod: this.formatMethods(stats.methods),
            salesByDate: chartData.map((d: any) => ({ date: d._id, total: d.total, orders: d.orders })),
            topProducts: topProducts
        };
    }

    /**
     * Calcula los rangos de fecha estrictos para Perú (UTC-5)
     */
    private getPeruDateRange(filters: ReportFilters): { start: Date, end: Date } {
        // 1. Si vienen fechas manuales (YYYY-MM-DD), las forzamos a UTC-5
        if (filters.startDate && filters.endDate) {
            return {
                start: new Date(`${filters.startDate}T00:00:00.000-05:00`),
                end: new Date(`${filters.endDate}T23:59:59.999-05:00`)
            };
        }

        // 2. Si usamos filtros relativos (today, week, month, year)
        // en-CA genera formato 'YYYY-MM-DD'
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });
        const now = new Date();
        const peruTodayStr = formatter.format(now); // Ej: "2026-09-26"
        
        let startStr = peruTodayStr;
        const endStr = peruTodayStr;

        // Creamos un objeto de fecha temporal anclado a medianoche de Perú
        const peruDate = new Date(`${peruTodayStr}T00:00:00.000-05:00`);

        if (filters.period === 'week') {
            peruDate.setDate(peruDate.getDate() - 7);
            startStr = formatter.format(peruDate);
        } else if (filters.period === 'month') {
            peruDate.setDate(1); // Día 1 del mes actual
            startStr = formatter.format(peruDate);
        } else if (filters.period === 'year') {
            peruDate.setMonth(0, 1); // 1 de Enero del año actual
            startStr = formatter.format(peruDate);
        }

        return {
            start: new Date(`${startStr}T00:00:00.000-05:00`),
            end: new Date(`${endStr}T23:59:59.999-05:00`)
        };
    }

    /**
     * Consolida los métodos de pago para el gráfico de Donut
     */
    private formatMethods(methods: any[]) {
        const summary: Record<string, number> = { CASH: 0, CARD: 0, YAPE: 0, PLIN: 0, TRANSFER: 0 };
        
        methods.forEach(m => {
            if (m.method) {
                summary[m.method] = (summary[m.method] || 0) + m.amount;
            }
        });

        // Retornar solo los que tienen montos mayores a cero para limpiar el gráfico
        return Object.keys(summary)
            .map(key => ({ method: key, amount: summary[key] }))
            .filter(item => item.amount > 0);
    }
}