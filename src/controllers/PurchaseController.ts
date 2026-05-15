import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../models/Product";
import { Purchase } from "../models/Purchase";

export class PurchaseController {
    static async createPurchase(req: Request, res: Response) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { proveedor, items } = req.body;

            let total = 0;

            // Validar y preparar items
            for (const item of items) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) {
                    throw new Error(`Producto no encontrado: ${item.productId}`);
                }

                const totalPrice = item.quantity * item.priceUnit;
                total += totalPrice;

                // Actualizar stock y costo promedio
                const nuevoStock = (product.stock || 0) + item.quantity;
                product.costo = item.priceUnit; // último precio de compra
                product.stock = nuevoStock;
                await product.save({ session });

                // Reemplazar el total calculado en cada item
                item.totalPrice = totalPrice;
            }

            // Crear la compra
            const nuevaCompra = new Purchase({
                proveedor,
                items,
                total,
                fecha: new Date(),
            });

            await nuevaCompra.save({ session });

            await session.commitTransaction();
            session.endSession();

            res.status(201).json(nuevaCompra);
            return;
        } catch (error: any) {
            await session.abortTransaction();
            session.endSession();
            console.error(error);
            res.status(500).json({ message: error.message || "Error al registrar la compra" });
            return;
        }
    }

    static async getPurchase(req: Request, res: Response) {
        const { id } = req.params;

        try {
            const purchase = await Purchase.findById(id).populate('items.productId', 'nombre sku barcode imagenes');
            if (!purchase) {
                res.status(404).json({ message: 'Compra no encontrada' });
                return;
            }

            res.json(purchase);
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message || "Error al obtener la compra" });
        }
    }

    static async getPurchases(req: Request, res: Response) {
        try {
            const { page = "1", limit = "10", numeroCompra, proveedor, fecha } = req.query;

            const pageNumber = Number(page) || 1;
            const limitNumber = Number(limit) || 10;

            const filters: any = {}

            // validar que el numeor de compra sea un number

            if (numeroCompra) {
                const parsedNumero = Number(numeroCompra);
                if (!isNaN(parsedNumero)) {
                    filters.numeroCompra = parsedNumero;
                } else {
                    res.status(400).json({ message: "El número de compra debe ser un número válido" });
                    return;
                }
            } if (proveedor) {
                filters.proveedor = { $regex: new RegExp(proveedor as string, "i") };
            }

            if (fecha) {
                // ejemplo: fecha = "2025-08-27"
                const start = new Date(fecha as string);
                start.setHours(0, 0, 0, 0);
                const end = new Date(fecha as string);
                end.setHours(23, 59, 59, 999);
                filters.createdAt = { $gte: start, $lte: end };
            }

            const purchases = await Purchase.find(filters)
                .sort({ createdAt: -1 })
                .limit(limitNumber)
                .skip((pageNumber - 1) * limitNumber)

            const total = await Purchase.countDocuments(filters);

            res.json({
                total,
                page: pageNumber,
                limit: limitNumber,
                purchases,
            });
        } catch (error: any) {
            console.error(error);
            res.status(500).json({ message: error.message || "Error al obtener las compras" });
        }
    }
}