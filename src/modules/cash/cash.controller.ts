import { RequestHandler, Request, Response } from 'express';
import { CashService } from './cash.service';

const cashService = new CashService();

/**
 * Tipamos explícitamente para evitar conflictos con el retorno de Express
 * Eliminamos el 'return' antes de res.status() para que la función devuelva void.
 */

export const getStatus: RequestHandler = async (req, res) => {
    try {
        const shift = await cashService.getActiveShift();
        res.status(200).json({ isOpen: !!shift, shift });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ message });
    }
};

export const open: RequestHandler = async (req, res) => {
    try {
        const { initialBalance, userId } = req.body as { initialBalance: number; userId: string };
        console.log("Intentando abrir caja con:", { initialBalance, userId });

        if (!userId) {
            console.warn("Falta userId en la solicitud de apertura de caja");
            res.status(400).json({ success: false, message: "User ID requerido" });
            return; // El return aquí es 'void', lo cual es correcto para RequestHandler
        }

        console.log("Llamando a cashService.openShift...");
        const shift = await cashService.openShift(userId, initialBalance);
        console.log("Caja abierta con éxito:", shift);
        res.status(201).json({ success: true, shift });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al abrir caja';
        res.status(400).json({ success: false, message });
    }
};

export const addMovement: RequestHandler = async (req, res) => {
    try {
        const { shiftId, type, amount, reason } = req.body;
        const shift = await cashService.addMovement(shiftId, type, amount, reason);
        res.status(200).json({ success: true, shift });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error en movimiento';
        res.status(400).json({ success: false, message });
    }
};

export const close: RequestHandler = async (req, res) => {
    try {
        const { shiftId, realBalance, userId, notes } = req.body;
        const shift = await cashService.closeShift(shiftId, realBalance, userId, notes);
        res.status(200).json({ success: true, shift });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al cerrar caja';
        res.status(400).json({ success: false, message });
    }
};

export const getSummary: RequestHandler = async (req, res) => {
    try {
        const { shiftId } = req.params;

        if (!shiftId) {
            res.status(400).json({ success: false, message: "ID de turno requerido" });
            return; // Importante: corta la ejecución devolviendo void
        }

        const summary = await cashService.getClosingSummary(shiftId);

        res.status(200).json({
            success: true,
            summary
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al obtener resumen';
        res.status(500).json({ success: false, message });
    }
};

export const getMovements: RequestHandler = async (req, res) => {
    try {
        const { shiftId } = req.params;
        if (!shiftId) {
            res.status(400).json({ success: false, message: "ID de turno requerido" });
            return;
        }
        const movements = await cashService.getMovements(shiftId);
        res.status(200).json({ success: true, movements });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Error al obtener movimientos';
        res.status(500).json({ success: false, message });
    }
};