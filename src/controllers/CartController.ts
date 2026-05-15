import { Request, Response } from 'express';
import Product from '../models/Product';
import Cart from '../models/Cart';

// TODO: Implementar la lógica para manejar el carrito de compras
// TODO: Integrar en la la logica 

export class CartController {
    static async getCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            // Fetch the cart for the user
            const cart = await Cart.findOne({ user: userId }).populate('products.product', 'nombre precio');

            if (!cart) {
                res.status(200).json({ message: 'Carrito vacío', products: [], totalPrice: 0 });
                return;
            }

            res.status(200).json(cart);

        } catch (error) {
            res.status(500).json({ message: 'Error al obtener el carrito' });
            return;
        }
    };

    static async clearCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            // Clear the cart for the user
            await Cart.findOneAndDelete({ user: userId });
            res.status(200).json({ message: 'Carrito vaciado' });
        } catch (error) {
            res.status(500).json({ message: 'Error al vaciar el carrito' });
            return;
        }
    }

    static async addProductToCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { productId, quantity = 1 } = req.body;

            // Verificar si el producto existe y obtener su precio
            const product = await Product.findById(productId).select('precio');
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }
            const cart = await Cart.findOne({ user: userId }).populate('products.product', 'name precio');

            if (!cart) {
                const newCart = new Cart({
                    user: userId,
                    products: [{ product: productId, quantity }],
                    totalPrice: product.precio * quantity,
                });
                await newCart.save();
                res.status(201).json(newCart);
                return;
            } else {
                const existingProductIndex = cart.products.findIndex(
                    (item) => item.product._id.toString() === productId
                );

                if (existingProductIndex !== -1) {
                    cart.products[existingProductIndex].quantity += quantity;
                    cart.totalPrice += product.precio * quantity;
                } else {
                    cart.products.push({ product: productId, quantity });
                    cart.totalPrice += product.precio * quantity;
                }                
            }
            await cart.save();
            res.status(200).json(cart);
        } catch (error) {
            // console.error('Error al agregar producto al carrito:', error);
            res.status(500).json({ message: 'Error al agregar el producto al carrito' });
            return;
        }
    };

    static async updateProductQuantity(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { productId, quantity } = req.body;

            // Verificar si el producto existe y obtener su precio
            const product = await Product.findById(productId).select('precio');
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            const cart = await Cart.findOne({ user: userId }).populate('products.product', 'name precio');

            if (!cart) {
                res.status(404).json({ message: 'Carrito no encontrado' });
                return;
            }

            const existingProductIndex = cart.products.findIndex(
                (item) => item.product._id.toString() === productId
            );

            if (existingProductIndex !== -1) {
                const oldQuantity = cart.products[existingProductIndex].quantity;
                cart.products[existingProductIndex].quantity = quantity;
                cart.totalPrice += (quantity - oldQuantity) * product.precio;
            } else {
                res.status(404).json({ message: 'Producto no encontrado en el carrito' });
                return;
            }

            await cart.save();
            res.status(200).json(cart);
        } catch (error) {
            // console.error('Error al actualizar la cantidad del producto:', error);
            res.status(500).json({ message: 'Error al actualizar la cantidad del producto' });
        }
    };

    static async removeProductFromCart(req: Request, res: Response) {
        try {
            const userId = req.user._id;
            const { productId } = req.params;

            // Verificar si el producto existe y obtener su precio
            const product = await Product.findById(productId).select('precio');
            if (!product) {
                res.status(404).json({ message: 'Producto no encontrado' });
                return;
            }

            const cart = await Cart.findOne({ user: userId }).populate('products.product', 'name precio');

            if (!cart) {
                res.status(404).json({ message: 'Carrito no encontrado' });
                return;
            }

            const existingProductIndex = cart.products.findIndex(
                (item) => item.product._id.toString() === productId
            );

            if (existingProductIndex !== -1) {
                const quantity = cart.products[existingProductIndex].quantity;
                cart.products.splice(existingProductIndex, 1);
                cart.totalPrice -= quantity * product.precio;
            } else {
                res.status(404).json({ message: 'Producto no encontrado en el carrito' });
                return;
            }

            await cart.save();
            res.status(200).json({ message: 'Producto eliminado del carrito', cart });
            
        } catch (error) {
            // console.error('Error al eliminar producto del carrito:', error);
            res.status(500).json({ message: 'Error al eliminar producto del carrito' });
        }
    };
}