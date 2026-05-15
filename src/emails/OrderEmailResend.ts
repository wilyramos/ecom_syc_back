import { resend } from "../config/resend";
import { baseEmailTemplate } from "./templates/baseEmailTemplate";
import type { IOrderItem } from "../models/Order";

export class OrderEmail {
  static async sendOrderConfirmationEmail({
    email,
    name,
    orderId,
    totalPrice,
    shippingMethod,
    items = [],
  }: {
    email: string;
    name?: string;
    orderId: string;
    totalPrice: number;
    shippingMethod: string;
    items?: IOrderItem[];
  }) {
    try {
      const itemsHtml = items
        .map(
          (item) => `
            <tr>
              <td style="padding:10px 0; border-bottom:1px solid #f0f0f0;">
                <img 
                  src="${item.imagen || "https://gophone.pe/logo.png"}"
                  alt="${item.nombre}"
                  style="width:55px; height:auto; border-radius:6px;"
                />
              </td>
              <td style="padding:10px; border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:500;">${item.nombre}</div>
              </td>
              <td style="text-align:center; border-bottom:1px solid #f0f0f0;">
                ${item.quantity}
              </td>
              <td style="text-align:right; border-bottom:1px solid #f0f0f0;">
                S/. ${item.price.toFixed(2)}
              </td>
              <td style="text-align:right; border-bottom:1px solid #f0f0f0;">
                <strong>S/. ${(item.price * item.quantity).toFixed(2)}</strong>
              </td>
            </tr>`
        )
        .join("");

      const emailContent = baseEmailTemplate({
        title: "Gracias por tu compra",
        content: `
          <div style="font-family:Inter,Arial,sans-serif; color:#111827; line-height:1.6;">
            <p style="font-size:15px;">Hola ${name || "cliente"},</p>
            <p style="font-size:15px;">
              Hemos recibido tu pedido <strong>#${orderId}</strong> y ya está siendo procesado.
            </p>

            <p style="margin-top:8px; font-size:15px;">
              <strong>Método de envío:</strong> ${shippingMethod}
            </p>

            <h3 style="margin-top:20px; font-size:17px; font-weight:600;">Resumen de tu pedido</h3>

            <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px;">
              <thead>
                <tr style="color:#6b7280; text-align:left;">
                  <th style="padding-bottom:6px;">Imagen</th>
                  <th style="padding-bottom:6px;">Producto</th>
                  <th style="padding-bottom:6px;">Cant.</th>
                  <th style="padding-bottom:6px; text-align:right;">Precio</th>
                  <th style="padding-bottom:6px; text-align:right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <p style="text-align:right; font-size:16px; margin-top:4px; font-weight:600;">
              Total pagado: S/. ${totalPrice.toFixed(2)}
            </p>

            <p style="margin-top:20px; font-size:14px; color:#4b5563;">
              Recibirás una notificación cuando tu pedido sea enviado.
            </p>

            <p style="margin-top:10px; font-size:14px;">
              Gracias por elegir <strong>GoPhone</strong>
            </p>
          </div>
        `,
      });

      await resend.emails.send({
        from: "GoPhone <contacto@gophone.pe>",
        to: email,
        subject: "Tu pedido ha sido confirmado 🛍️",
        html: emailContent,
      });

      return {
        success: true,
        message: "Email de confirmación enviado correctamente",
      };
    } catch (error) {
      console.error("❌ Error al enviar el email de confirmación:", error);
      return {
        success: false,
        message: "Error al enviar el email de confirmación",
      };
    }
  }
}
