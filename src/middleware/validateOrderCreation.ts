import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';

// añadiendo user al Request de express
declare global {
    namespace Express {
        interface Request {
            
        }
    }
} // para que typescript no se queje de que no existe user en Request

export const validateOrderCreation = async (req: Request, res: Response, next: NextFunction) => {

    

}