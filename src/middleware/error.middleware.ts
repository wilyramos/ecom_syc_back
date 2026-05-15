import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const globalErrorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // En desarrollo queremos ver todo el stack trace
    if (process.env.NODE_ENV === 'development') {
        res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } 
    // En producción no queremos filtrar detalles técnicos al usuario
    else {
        // Errores conocidos (AppError)
        if (err.isOperational) {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        } 
        // Errores desconocidos o de programación (Bugs, fallos de BD, etc.)
        else {
            console.error('ERROR 💥:', err); // Log para nosotros
            res.status(500).json({
                status: 'error',
                message: 'Algo salió muy mal en el servidor'
            });
        }
    }
};