import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";

interface SenEmailProps {
    to: string;
    subject: string;
    content: string;
}

export class AuthEmailResend {

    static async sendWelcomeEmail({ email, name }: { email: string; name: string }) {

        try {
            const emailContent = baseEmailTemplate({
                title: "Bienvenido a GoPhone",
                content: `<p>Hola ${name},</p>
                          <p>Gracias por registrarte en GoPhone. Estamos emocionados de tenerte con nosotros.</p>
                          <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                          <p>Saludos,</p>
                          <p>El equipo de GoPhone</p>`
            });

            const response = await resend.emails.send({
                from: 'GoPhone <contacto@gophone.pe>',
                to: email,
                subject: 'Bienvenido a GoPhone',
                html: emailContent
            });

            // console.log("Welcome email sent successfully:", response);
            return {
                success: true,
                message: "Welcome email sent successfully"
            };

        } catch (error) {

            console.error('Error sending welcome email:', error);
        }
    }

    static async sendEmailForgotPassword({ email, token }: { email: string; token: string }) {
        try {
            const resetLink = `${process.env.FRONTEND_URL}/auth/reset-password?token=${token}`;

            const emailContent = baseEmailTemplate({
                title: "Restablecer contraseña",
                content: `
                <p>Hola,</p>
                <p>Hemos recibido una solicitud para restablecer tu contraseña.</p>
                <p>Haz clic en el siguiente enlace para restablecerla:</p>
                <p><a href="${resetLink}" style="color:#1a73e8;">Restablecer contraseña</a></p>
                <p>Este enlace expirará en 15 minutos.</p>
                <p>Si no realizaste esta solicitud, puedes ignorar este correo.</p>
                <p>Saludos,<br/>El equipo de GoPhone</p>
            `
            });

            const response = await resend.emails.send({
                from: 'GoPhone <contacto@gophone.pe>',
                to: email,
                subject: 'Restablecimiento de contraseña',
                html: emailContent
            });

            return {
                success: true,
                message: "Email de restablecimiento de contraseña enviado exitosamente"
            };

        } catch (error) {
            console.error('Error enviando email de restablecimiento de contraseña:', error);
            return {
                success: false,
                message: 'Error al enviar el correo',
            };
        }
    }

    static async sendEmailPasswordUpdated({ email }: { email: string }) {
        try {
            const emailContent = baseEmailTemplate({
                title: "Contraseña actualizada",
                content: `<p>Hola,</p>
                          <p>Tu contraseña ha sido actualizada exitosamente.</p>
                          <p>Si no realizaste esta acción, por favor contacta a soporte.</p>
                          <p>Saludos,</p>
                          <p>El equipo de GoPhone</p>`
            });

            const response = await resend.emails.send({
                from: 'GoPhone <contacto@gophone.pe>',
                to: email,
                subject: 'Contraseña actualizada',
                html: emailContent
            });

            return {
                success: true,
                message: "Email de confirmación de actualización de contraseña enviado exitosamente"
            };

        } catch (error) {
            console.error('Error enviando email de confirmación de actualización de contraseña:', error);
            return {
                success: false,
                message: 'Error al enviar el correo',
            };
        }
    }
}