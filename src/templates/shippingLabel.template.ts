import PDFKit from "pdfkit";
import { IOrder } from "../models/Order";
import { IUser } from "../models/User";

const COMPANY = {
    nombre: "GOPHONE PERÚ",
    direccion: "Jr. Bernardo O'Higgins 120, Cañete, Lima",
    telefono: "925 054 636"
};

export const buildShippingLabel = (doc: PDFKit.PDFDocument, order: IOrder) => {
    // Obtenemos los datos del usuario
    const user = order.user as unknown as IUser;
    const customerName = user && user.nombre ? `${user.nombre} ${user.apellidos || ''}` : "Cliente";
    const customerPhone = user && user.telefono ? user.telefono : "Sin teléfono";
    const ship = order.shippingAddress;

    const marginX = 20;
    let currentY = 20;

    // 1. ZONA DEL REMITENTE (Gophone) - Letra pequeña
    doc.font("Helvetica-Bold").fontSize(10).text("REMITENTE:", marginX, currentY);
    doc.font("Helvetica").fontSize(9)
       .text(COMPANY.nombre, marginX, currentY + 12)
       .text(COMPANY.direccion, marginX, currentY + 24)
       .text(`Tel: ${COMPANY.telefono}`, marginX, currentY + 36);

    currentY += 60;

    // Línea separadora gruesa
    doc.strokeColor("#000000").lineWidth(2).moveTo(marginX, currentY).lineTo(268, currentY).stroke();
    currentY += 15;

    // 2. ZONA DEL DESTINATARIO (El Cliente) - Letra MUY GRANDE para el Courier
    doc.font("Helvetica-Bold").fontSize(14).text("DESTINATARIO / ENTREGAR A:", marginX, currentY);
    currentY += 20;

    doc.font("Helvetica-Bold").fontSize(18).text(customerName.toUpperCase(), marginX, currentY, { width: 248 });
    currentY += doc.heightOfString(customerName.toUpperCase(), { width: 248 }) + 5;

    doc.font("Helvetica-Bold").fontSize(12).text(`Telf: ${customerPhone}`, marginX, currentY);
    currentY += 20;

    // Dirección exacta
    doc.font("Helvetica").fontSize(12)
       .text(`${ship.direccion}`, marginX, currentY, { width: 248 });
    currentY += doc.heightOfString(ship.direccion, { width: 248 }) + 5;

    doc.font("Helvetica-Bold").fontSize(12)
       .text(`${ship.distrito}, ${ship.provincia}, ${ship.departamento}`.toUpperCase(), marginX, currentY, { width: 248 });
    currentY += 25;

    // Referencia (Crítico para repartidores)
    if (ship.referencia) {
        doc.font("Helvetica-Oblique").fontSize(10)
           .text(`Ref: ${ship.referencia}`, marginX, currentY, { width: 248 });
        currentY += doc.heightOfString(`Ref: ${ship.referencia}`, { width: 248 }) + 10;
    }

    // Línea separadora
    doc.strokeColor("#000000").lineWidth(1).moveTo(marginX, currentY).lineTo(268, currentY).stroke();
    currentY += 15;

    // 3. ZONA DE LOGÍSTICA / CÓDIGO DE ORDEN
    doc.font("Helvetica-Bold").fontSize(12).text("ORDEN N°:", marginX, currentY);
    doc.font("Helvetica").fontSize(12).text(order.orderNumber, marginX + 70, currentY);
    
    currentY += 20;
    doc.font("Helvetica-Bold").fontSize(12).text("PESO / PAQ:", marginX, currentY);
    doc.font("Helvetica").fontSize(12).text(`1 Paquete(s) - ${order.items.length} item(s)`, marginX + 85, currentY);

    // Mensaje de Seguridad (Abajo del todo)
    const footerY = 390; // Cerca del borde inferior (432 es el alto total)
    doc.rect(marginX, footerY, 248, 22).fillAndStroke("#000000", "#000000");
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(12)
       .text("MANEJAR CON CUIDADO - FRÁGIL", marginX, footerY + 6, { align: "center", width: 248 });
};