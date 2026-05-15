import { Request, Response } from 'express';
import User from "../models/User";
import { generateJWT } from '../utils/jwt';
import { checkPassword, hashPassword } from "../utils/auth";
import Token from '../models/Token';
import { generateToken } from '../utils/token';
import { AuthEmailResend } from '../emails/AuthEmailResend';
import { googleClient } from '../config/googleClient';

export class AuthController {

    static async register(req: Request, res: Response) {
        try {
            const { nombre, email, password } = req.body;

            // Verificar si el usuario ya existe
            const userExists = await User.findOne({ email });
            if (userExists) {
                res.status(400).json({ message: 'El usuario ya existe' });
                return;
            }

            // Hashear la contraseña
            const hashedPassword = await hashPassword(password);

            // Crear el nuevo usuario
            const newUser = new User({
                nombre,
                email,
                password: hashedPassword
            });

            await newUser.save();
            // Generar un token JWT
            const token = generateJWT({ id: newUser.id });

            // Send email de bienvenida

            AuthEmailResend.sendWelcomeEmail({
                email: newUser.email,
                name: newUser.nombre
            }).then(() => {
                console.log('Email de bienvenida enviado exitosamente');
            }).catch((error) => {
                console.error('Error al enviar el email de bienvenida:', error);
            });

            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                userId: newUser.id,
                token: token
            });
        } catch (error) {
            res.status(500).json({ message: 'Error al registrar el usuario' });
            return;
        }
    }

    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            // Verificar si el usuario existe
            const user = await User.findOne({ email }).select('+password');
            if (!user) {
                res.status(400).json({ message: 'Credenciales invalidas' });
                return;
            }

            // console.log(user.rol)

            // Verificar la contraseña
            const isPasswordValid = await checkPassword(password, user.password);

            if (!isPasswordValid) {
                res.status(400).json({ message: 'Credenciales invalidas' });
                return;
            }

            // Generar un token JWT
            const token = generateJWT({ id: user.id });

            res.status(200).json({
                message: 'Inicio de sesión exitsdasdoso',
                userId: user.id,
                token: token,
                role: user.rol,
            });
        } catch (error) {
            // console.error('Error en el inicio de sesión:', error);
            res.status(500).json({ message: 'Error al iniciar sesión' });
            return;
        }
    }

    static async loginWithGoogle(req: Request, res: Response) {
        try {
            const { credential } = req.body;

            // console.log("Google Login Credential:", credential);

            if (!credential) {
                res.status(400).json({ message: 'Token de Google no recibido' });
                return;
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID
            });

            // console.log("Google Ticket:", ticket);

            const payload = ticket.getPayload();
            if (!payload) {
                res.status(400).json({ message: 'Token de Google inválido' });
                return;
            }

            // console.log("Google Payload:", payload);

            let user = await User.findOne({ googleId: payload.sub });

            if (!user) {
                // Buscar por email en caso ya exista una cuenta con ese email
                user = await User.findOne({ email: payload.email });

                if (user) {
                    // Asociar cuenta existente con cuenta de Google
                    user.googleId = payload.sub;
                    if (!user.nombre) user.nombre = payload.name;
                    await user.save();
                } else {
                    // Crear nuevo usuario
                    user = new User({
                        nombre: payload.name,
                        email: payload.email,
                        googleId: payload.sub,
                    });
                    await user.save();

                    // Send email de bienvenida
                    AuthEmailResend.sendWelcomeEmail({
                        email: user.email,
                        name: user.nombre
                    });
                }
            }

            // console.log("User found or created:", user);

            const token = generateJWT({ id: user.id });

            res.status(200).json({
                message: 'Inicio de sesión con Google exitoso',
                userId: user.id,
                token,
                role: user.rol,
            });

        } catch (error) {
            // console.error('Error al iniciar sesión con Google:', error);
            res.status(500).json({ message: 'Error al iniciar sesión con Google' });
            return;
        }
    }

    static async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;

            // Verificar si el usuario existe
            const user = await User.findOne({ email });
            if (!user) {
                res.status(400).json({ message: 'El usuario no existe' });
                return;
            }

            const token = new Token();
            token.token = generateToken();
            token.user = user.id;
            await token.save();

            // Send email with reset password link
            AuthEmailResend.sendEmailForgotPassword({
                email: user.email,
                token: token.token
            }).then(() => {
                console.log('Email de restablecimiento de contraseña enviado exitosamente');
            }).catch((error) => {
                console.error('Error al enviar el email de restablecimiento de contraseña:', error);
            });

            // Generar un token de restablecimiento de contraseña

            res.status(200).json({ message: 'Email de restablecimiento de contraseña enviadoo' });

        } catch (error) {
            res.status(500).json({ message: 'Error al restablecer la contraseña' });
            return;
        }
    }

    static async updatePasswordWithToken(req: Request, res: Response) {
        try {
            const { token } = req.params;
            const { password } = req.body;

            const tokenExists = await Token.findOne({ token });
            if (!tokenExists) {
                res.status(400).json({ message: 'Token no valido o expirado' });
                return;
            }

            const user = await User.findById(tokenExists.user);
            if (!user) {
                res.status(400).json({ message: 'Usuario no encontrado' });
                return;
            }

            // Hashear la nueva contraseña
            const hashedPassword = await hashPassword(password);
            user.password = hashedPassword;
            // await user.save();
            // await tokenExists.deleteOne();

            await Promise.all([user.save(), tokenExists.deleteOne()]);

            // Send email notification
            AuthEmailResend.sendEmailPasswordUpdated({
                email: user.email
            });

            res.status(200).json({ message: 'Contraseña actualizada exitosamente' });

        } catch (error) {
            res.status(500).json({ message: 'Error al restablecer la contraseña' });
            return;
        }
    }

    static async validateToken(req: Request, res: Response) {
        try {
            const { token } = req.params;

            // Verificar si el token existe
            const tokenExists = await Token.findOne({ token });
            if (!tokenExists) {
                res.status(400).json({ message: 'Token inválido' });
                return;
            }

            res.json({ message: 'Token válido' });

        } catch (error) {
            res.status(500).json({ message: 'Error al validar el token' });
            return;
        }
    }

    static async getUser(req: Request, res: Response) {
        res.json(req.user);
    }

    static async createUserIfNotExists(req: Request, res: Response) {
        const { email, nombre, apellidos, tipoDocumento, numeroDocumento, telefono } = req.body;
        try {
            const userExists = await User.findOne({ email });

            if (userExists) {
                res.status(200).json({ message: 'El usuario ya existe', userId: userExists.id });
                return;
            }

            // Crear el nuevo usuario
            const newUser = new User({
                email,
                nombre,
                apellidos,
                tipoDocumento,
                numeroDocumento,
                telefono
            });

            await newUser.save();

            // Send email de bienvenida
            AuthEmailResend.sendWelcomeEmail({
                email: newUser.email,
                name: newUser.nombre
            });

            res.status(201).json({
                message: 'Usuario nuevo creado exitosamente',
                userId: newUser.id
            });

        } catch (error) {
            res.status(500).json({ message: 'Error al crear el usuario' });
            return;
        }
    }

    static async editUser(req: Request, res: Response) {
        const { email, nombre, apellidos, tipoDocumento, numeroDocumento, telefono } = req.body;


        console.log("Edit User Request Body:", req.body);

        try {
            
            const userExists = await User.findById(req.user.id);

            if (!userExists) {
                res.status(404).json({ message: 'Usuario no encontrado' });
                return;
            }

            // Verificar si el email ya está en uso por otro usuario
            if (email && email !== userExists.email) {
                const emailExists = await User.findOne({ email });
                if (emailExists) {
                    res.status(400).json({ message: 'El email ya está en uso por otro usuario' });
                    return;
                }
            }

            

            // Actualizar los campos del usuario
            userExists.email = email || userExists.email;
            userExists.nombre = nombre || userExists.nombre;
            userExists.apellidos = apellidos || userExists.apellidos;
            userExists.tipoDocumento = tipoDocumento || userExists.tipoDocumento;
            userExists.numeroDocumento = numeroDocumento || userExists.numeroDocumento;
            userExists.telefono = telefono || userExists.telefono;


            await userExists.save();

            res.status(200).json({
                message: 'Usuario actualizado exitosamente'            });

        } catch (error) {
            res.status(500).json({ message: 'Error al actualizar el usuario' });
            return;
        }
    }

    static async oauthLogin(req: Request, res: Response) {
        try {
                const { provider, providerId, email, nombre } = req.body;
                if (!provider || !providerId || !email) {
                    res.status(400).json({ message: 'Datos incompletos para OAuth' });
                    return;
                }
                let user = await User.findOne({ 'providers.provider': provider, 'providers.providerId': providerId });
                if (!user) {
                    // Buscar por email en caso ya exista una cuenta con ese email
                    user = await User.findOne({ email });
                }
                if (user) {
                    // Asociar cuenta existente con cuenta del proveedor OAuth si no está ya asociada
                    // const alreadyLinked = user.providers.some(p => p.provider === provider && p.providerId === providerId);
                    // if (!alreadyLinked) {
                    //     user.providers.push({ provider, providerId });
                    //     await user.save();
                    // }
                }
                else {
                    // Crear nuevo usuario
                    user = new User({
                        nombre,
                        email,
                        providers: [{ provider, providerId }]
                    });
                    await user.save();
                    // Send email de bienvenida
                    AuthEmailResend.sendWelcomeEmail({
                        email: user.email,
                        name: user.nombre
                    });
                }
                const token = generateJWT({ id: user.id });
                res.status(200).json({
                    message: 'Inicio de sesión OAuth exitoso',
                    userId: user.id,
                    token,
                    role: user.rol,
                });
        } catch (error) {
            res.status(500).json({ message: 'Error en el login OAuth' });
        }
    }
}