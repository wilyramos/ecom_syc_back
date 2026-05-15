import mongoose, { Schema, Document, PopulatedDoc, Types } from 'mongoose';
import { IProduct } from './Product';
import { IUser } from './User';

export interface ICartProduct {
    product: Types.ObjectId | PopulatedDoc<IProduct & Document>;
    quantity: number;
}

export interface ICart extends Document {

    user: Types.ObjectId | PopulatedDoc<IUser & Document>;
    products: ICartProduct[];
    totalPrice: number;
}

const cartSchema = new Schema<ICart>(

    {
        user: { type: Types.ObjectId, ref: 'User', required: true },
        products: [
            {
                product: { type: Types.ObjectId, ref: 'Product', required: true },
                quantity: { type: Number, required: true, min: 1 }
            }
        ],
        totalPrice: { type: Number, default: 0 }
    },
    { timestamps: true }
);

cartSchema.index({ user: 1 }, { unique: true }); // Ensure one cart per user



const Cart = mongoose.model<ICart>('Cart', cartSchema);
export default Cart;