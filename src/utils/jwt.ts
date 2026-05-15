import jwt from 'jsonwebtoken';
import Types from 'mongoose';

type UserPayload = {
    id: Types.ObjectId
}

export const generateJWT = (payload: UserPayload) => {

    const token = jwt.sign(payload, process.env.JWT_SECRET, { 
        expiresIn: '90d'
    })
    
    return token
}

// payload is the user id that we want to store in the token