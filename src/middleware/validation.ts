import type { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export const handleInputErrors = (req: Request, res: Response, next: NextFunction) => {
    let errors = validationResult(req);
    if(!errors.isEmpty()){

        /* Para retornar todos los errores 
        res.status(400).json({errors: errors.array()});
        return;

        */
        const firstMessage = errors.array()[0].msg || "Error de validación";
        res.status(400).json({ message: firstMessage });
        return;
    }
    next();
}