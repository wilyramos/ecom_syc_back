//File: backend/src/controllers/SaleController.

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Sale } from '../models/Sale';
import Product from '../models/Product';
import { startOfDay, endOfDay, parseISO, differenceInDays } from 'date-fns';
import { SaleStatus, PaymentMethod } from '../models/Sale';
import PDFDocument from "pdfkit";
import { generateSalePDF } from '../utils/generateTicket';


export class SaleController {

    static async createSale(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const {
                customerId,
                customerSnapshot,
                employee,
                items,
                totalDiscountAmount = 0,
                status = SaleStatus.COMPLETED,
                paymentMethod = PaymentMethod.CASH,
                paymentStatus = 'APPROVED',
                deliveryMethod = 'PICKUP',
                storeLocation,
                receiptType = 'NOTA',
                receiptNumber,
            } = req.body;

            const validatedItems: any[] = [];

            for (const item of items) {
                const product = await Product.findById(item.product).session(session);
                if (!product) {
                    res.status(400).json({ message: `Producto no encontrado: ${item.product}` });
                    return;
                }

                let unitPrice = product.precio || 0;
                let unitCost = product.costo || 0;

                // ======== MANEJO DE VARIANTE (idéntico al webhook) ========
                if (item.variantId) {
                    const variant = product.variants?.find(v => v._id.toString() === item.variantId);
                    if (!variant) {
                        res.status(400).json({ message: `Variante no encontrada para el producto: ${product.nombre}` });
                        return;
                    }
                    if (variant.stock < item.quantity) {
                        res.status(400).json({ message: `Stock insuficiente para la variante de: ${product.nombre}` });
                        return;
                    }

                    // Descontar stock
                    variant.stock -= item.quantity;

                    // Si la variante tiene precio/costo propio, usarlos
                    unitPrice = variant.precio ?? unitPrice;
                    unitCost = variant.costo ?? unitCost;

                    // Recalcular stock total del producto
                    product.stock = product.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
                }
                else {
                    // ======== Producto sin variante ========
                    if (product.stock < item.quantity) {
                        res.status(400).json({ message: `Stock insuficiente para el producto: ${product.nombre}` });
                        return;
                    }
                    product.stock -= item.quantity;
                }

                await product.save({ session });

                validatedItems.push({
                    product: product._id,
                    variantId: item.variantId || undefined,
                    quantity: item.quantity,
                    price: unitPrice,
                    cost: unitCost,
                });
            }

            const totalPrice = validatedItems.reduce((sum, i) => sum + i.price * i.quantity, 0) - totalDiscountAmount;

            const sale = new Sale({
                customer: customerId || undefined,
                customerSnapshot: customerSnapshot || undefined,
                employee,
                items: validatedItems,
                totalPrice,
                totalDiscountAmount,
                receiptType,
                receiptNumber,
                status,
                paymentMethod,
                paymentStatus,
                deliveryMethod,
                storeLocation
            });

            await sale.save({ session });
            await session.commitTransaction();

            res.status(201).json({
                message: 'Venta creada correctamente',
                saleId: sale._id
            });
            return;
        } catch (error) {
            console.error("Error al crear la venta:", error);
            await session.abortTransaction();
            res.status(500).json({ message: `Error al crear la venta: ${error.message}` });
            return;
        } finally {
            session.endSession();
            return;
        }
    }


    static async getSale(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const sale = await Sale.findById(id).populate({ path: 'items.product', select: 'nombre imagenes' });
            if (!sale) {
                res.status(404).json({ message: 'Venta no encontrada' });
                return;
            }
            res.json(sale);
        } catch (error) {
            res.status(500).json({ message: `Error al obtener la venta: ${error.message}` });
        }
    }

    static async getSales(req: Request, res: Response) {
        try {
            const { search, fechaInicio, fechaFin, page = '1', limit = '10' } = req.query;
            const userId = req.user._id;

            const query: any = { employee: userId };

            // Filtro por DNI
            if (search && typeof search === 'string') {
                query.customerDNI = search;
            }

            // Filtro por rango de fechas
            if (fechaInicio || fechaFin) {
                query.createdAt = {};
                if (fechaInicio && typeof fechaInicio === 'string') {
                    const inicio = startOfDay(parseISO(fechaInicio));
                    query.createdAt.$gte = inicio;
                }
                if (fechaFin && typeof fechaFin === 'string') {
                    const fin = endOfDay(parseISO(fechaFin));
                    query.createdAt.$lte = fin;
                }
            }

            const pageNumber = parseInt(page as string, 10);
            const limitNumber = parseInt(limit as string, 10);
            const skip = (pageNumber - 1) * limitNumber;

            const [sales, totalSales, totalAmountResult] = await Promise.all([
                Sale.find(query)
                    // .populate({ path: 'items.product', select: 'nombre imagenes' })
                    .populate({ path: 'employee', select: 'nombre' })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNumber)
                    .lean(),

                Sale.countDocuments(query),

                // Agregación para calcular el total vendido
                Sale.aggregate([
                    { $match: query },
                    {
                        $group: {
                            _id: null,
                            totalAmount: { $sum: "$totalPrice" },
                        },
                    },
                ]),
            ]);

            const totalAmount = totalAmountResult.length > 0 ? totalAmountResult[0].totalAmount : 0;

            res.json({
                sales,
                totalSales,
                totalAmount, // <- total de dinero vendido
                currentPage: pageNumber,
                totalPages: Math.ceil(totalSales / limitNumber),
            });
        } catch (error) {
            res.status(500).json({ message: `Error al obtener las ventas: ${error.message}` });
            return;
        }
    }

    static async getSalesReport(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));
            const diffDays = differenceInDays(endDate, startDate);
            // Agrupación por día o por mes
            const dateFormat = diffDays <= 31 ? "%Y-%m-%d" : "%Y-%m";

            const report = await Sale.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: startDate,
                            $lte: endDate
                        }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: dateFormat,
                                date: "$createdAt"
                            }
                        },
                        ventas: { $sum: "$totalPrice" },
                        cantidadVentas: { $sum: 1 },
                        unidadesVendidas: { $sum: { $sum: "$items.quantity" } },
                    }
                },
                {
                    $project: {
                        label: "$_id",
                        ventas: 1,
                        cantidadVentas: 1,
                        unidadesVendidas: 1,
                        _id: 0
                    }
                },
                { $sort: { label: 1 } }
            ]);

            res.json({ report });
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: `Error al generar el reporte: ${error.message}` });
            return;
        }
    }

    static async getSalesSummary(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            console.log("Fechas:", fechaInicio, "a", fechaFin);

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const [salesTotals] = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalSales: { $sum: "$totalPrice" },
                        numberSales: { $sum: 1 }
                    }
                }
            ]);

            const [costTotals] = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: null,
                        totalUnitsSold: { $sum: "$items.quantity" },
                        totalCost: {
                            $sum: {
                                $multiply: [
                                    "$items.quantity",
                                    { $ifNull: ["$items.cost", "$items.price"] }  // Usa costo si existe, si no, el mismo precio
                                ]
                            }
                        }
                    }
                }
            ]);

            // Combinar ambos resultados
            const summary = {
                totalSales: salesTotals?.totalSales || 0,
                numberSales: salesTotals?.numberSales || 0,
                totalUnitsSold: costTotals?.totalUnitsSold || 0,
                margin: (salesTotals?.totalSales || 0) - (costTotals?.totalCost || 0)
            };

            res.json({ summary });
            return;
        } catch (error) {
            console.error("Error al obtener el resumen de ventas:", error);
            res.status(500).json({ message: `Error al obtener el resumen de ventas: ${error.message}` });
            return;
        }
    }

    // para obtener top de productos mas vendidos

    static async getTopProducts(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin, limit = 10 } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const topProducts = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: "COMPLETED" // solo ventas completadas
                    }
                },
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$items.product", // ahora usamos items.product (ObjectId de Product)
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                        totalCost: { $sum: { $multiply: ["$items.quantity", "$items.cost"] } }
                    }
                },
                {
                    $addFields: {
                        margin: { $subtract: ["$totalSales", "$totalCost"] }
                    }
                },
                {
                    $lookup: {
                        from: "products", // nombre de la colección de productos en MongoDB
                        localField: "_id",
                        foreignField: "_id",
                        as: "product"
                    }
                },
                { $unwind: "$product" },
                {
                    $project: {
                        _id: 0,
                        productId: "$_id",
                        nombre: "$product.nombre", // ajusta al campo real de tu Product
                        totalQuantity: 1,
                        totalSales: 1,
                        margin: 1
                    }
                },
                { $sort: { totalQuantity: -1 } }, // Ordenar por cantidad vendida
                { $limit: Number(limit) }
            ]);

            res.json({ topProducts });
            return;
        } catch (error) {
            console.error("Error al obtener los productos más vendidos:", error);
            res.status(500).json({ message: `Error al obtener los productos más vendidos: ${error.message}` });
            return;
        }
    }

    static async getReportByVendors(req: Request, res: Response) {
        try {
            const { fechaInicio, fechaFin } = req.query;

            if (!fechaInicio || !fechaFin || typeof fechaInicio !== 'string' || typeof fechaFin !== 'string') {
                res.status(400).json({ message: 'Debe proporcionar fechaInicio y fechaFin válidas' });
                return;
            }

            const startDate = startOfDay(parseISO(fechaInicio));
            const endDate = endOfDay(parseISO(fechaFin));

            const report = await Sale.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: "COMPLETED"
                    }
                },
                // Desglosamos items para contar unidades
                { $unwind: "$items" },
                {
                    $group: {
                        _id: "$employee", // agrupamos por vendedor
                        totalUnits: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                        totalCost: { $sum: { $multiply: ["$items.quantity", "$items.cost"] } },
                        // número de ventas únicas (facturas) → usamos $addToSet
                        salesSet: { $addToSet: "$_id" }
                    }
                },
                {
                    $addFields: {
                        numSales: { $size: "$salesSet" }, // cantidad de ventas únicas
                        margin: { $subtract: ["$totalSales", "$totalCost"] }
                    }
                },
                {
                    $lookup: {
                        from: "users", // colección de empleados
                        localField: "_id",
                        foreignField: "_id",
                        as: "employee"
                    }
                },
                { $unwind: "$employee" },
                {
                    $project: {
                        _id: 0,
                        employeeId: "$_id",
                        nombre: "$employee.nombre", // ajusta según tu User model
                        numSales: 1,
                        totalUnits: 1,
                        totalSales: 1,
                        margin: 1
                    }
                },
                { $sort: { totalSales: -1 } },
            ]);

            res.json({ report });
            return;

        } catch (error) {

        }
    }

  static async getSalePdf(req: Request, res: Response) {
        const saleId = req.params.id;

        try {
            const sale = await Sale.findById(saleId)
                .populate("items.product")
                .populate("employee"); // Asegúrate de popular al empleado si necesitas su nombre

            if (!sale) {
                res.status(404).json({ message: "Venta no encontrada" });
                return;
            }

            // Aquí puedes configurar las opciones iniciales del documento si lo deseas
            const doc = new PDFDocument({ size: "A4", margin: 40 });

            // Manejo de la salida a través de Response stream (express) en lugar de buffers en memoria
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${sale.receiptType}-${saleId}.pdf"`
            );

            // Vinculamos el flujo de salida del PDF directamente a la respuesta HTTP
            doc.pipe(res);

            // Define la ruta absoluta al logo.
            // Asegúrate de que el archivo 'logo.png' exista en la ruta especificada.
            // 'process.cwd()' apunta a la raíz de donde se ejecuta Node (típicamente la raíz de tu proyecto backend).
            const path = require('path');
            const logoPath = path.join(process.cwd(), 'public', 'logobw.jpg');

            // Llama a la función generadora pasándole el doc, los datos de la venta y la ruta del logo
            generateSalePDF(doc, sale, logoPath);

            // Finaliza el documento, lo que cerrará el stream y enviará el PDF al cliente
            doc.end();

        } catch (error) {
            console.error("Error al generar PDF:", error);
            res.status(500).json({ message: "Error al generar PDF" });
            return;
        }
    }
}