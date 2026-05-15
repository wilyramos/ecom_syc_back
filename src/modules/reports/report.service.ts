import { Sale } from "../../models/Sale";
import Product from "../../models/Product";

export class ReportService {
    async getStats(period: string) {
        const startDate = this.getStartDate(period);

        // Promesa paralela para obtener datos de diferentes colecciones
        const [salesData, inventoryData] = await Promise.all([
            // 1. Agregación de Ventas y Utilidad
            Sale.aggregate([
                { $match: { createdAt: { $gte: startDate }, status: "COMPLETED" } },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totalPrice" },
                        totalOrders: { $sum: 1 },
                        // Calculamos la utilidad sumando (precio - costoAtSale) de cada item
                        netProfit: { 
                            $sum: { 
                                $reduce: {
                                    input: "$items",
                                    initialValue: 0,
                                    in: { $add: ["$$value", { $subtract: ["$$this.price", { $ifNull: ["$$this.costAtSale", 0] }] }] }
                                }
                            }
                        },
                        // Agrupación por método de pago dentro de la misma consulta
                        methods: { $push: { method: "$paymentMethod", amount: "$totalPrice" } }
                    }
                }
            ]),

            // 2. Valor de Inventario y Alertas
            Product.aggregate([
                { $match: { isActive: true } },
                {
                    $group: {
                        _id: null,
                        inventoryValue: { $sum: { $multiply: [{ $ifNull: ["$costo", 0] }, { $ifNull: ["$stock", 0] }] } },
                        lowStockCount: {
                            $sum: { $cond: [{ $lte: ["$stock", "$minStock"] }, 1, 0] }
                        }
                    }
                }
            ]),

            
        ]);

        // Procesar los resultados (MongoDB aggregate devuelve un array)
        const sales = salesData[0] || { totalSales: 0, totalOrders: 0, netProfit: 0, methods: [] };
        const inventory = inventoryData[0] || { inventoryValue: 0, lowStockCount: 0 };

        return {
            totalSales: sales.totalSales,
            totalOrders: sales.totalOrders,
            netProfit: sales.netProfit,
            inventoryValue: inventory.inventoryValue,
            lowStockCount: inventory.lowStockCount,
            salesByMethod: this.formatMethods(sales.methods)
        };
    }

    private getStartDate(period: string): Date {
        const date = new Date();
        date.setHours(0, 0, 0, 0);

        if (period === 'week') {
            date.setDate(date.getDate() - 7);
        } else if (period === 'month') {
            date.setMonth(date.getMonth() - 1);
        }
        return date;
    }

    private formatMethods(methods: any[]) {
        const summary: Record<string, number> = {};
        methods.forEach(m => {
            summary[m.method] = (summary[m.method] || 0) + m.amount;
        });
        return Object.keys(summary).map(key => ({ method: key, amount: summary[key] }));
    }
}