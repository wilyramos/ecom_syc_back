// File: backend/src/templates/orderReceipt.template.ts

import PDFKit from "pdfkit";
import { IOrder } from "../models/Order";
import { IUser } from "../models/User";

const COMPANY = {
    nombre: "GOPHONE",
    ruc: "1072516715",
    direccion: "Jr. Bernardo O'Higgins 120",
    city: "Cañete, Lima - Perú",
    telefono: "925054636",
    email: "ventas@gophone.pe",
};

const COLORS = {
    primary: "#111827",    // gray-900 
    secondary: "#4B5563",  // gray-600 
    muted: "#9CA3AF",      // gray-400 
    border: "#E5E7EB",     // gray-200 
    surface: "#F9FAFB",    // gray-50 
};

// Helpers de formato
const formatCurrency = (value: number, currency: string = "PEN") => {
    const symbol = currency === "PEN" ? "S/" : currency === "USD" ? "$" : currency;
    return `${symbol} ${value.toFixed(2)}`;
};

const formatDate = (date?: Date | string) => {
    if (!date) return new Date().toLocaleDateString('es-PE');
    return new Date(date).toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
};

const generateHr = (doc: PDFKit.PDFDocument, y: number) => {
    doc.strokeColor(COLORS.border).lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
};

export const buildOrderReceipt = (doc: PDFKit.PDFDocument, order: IOrder, logoPath?: string) => {
    let currentY = 50;
    if (logoPath) {
        // En tu controller deberás pasar el path absoluto al logo, o remover esta condición si no lo usas.
        try {
             doc.image(logoPath, 60, currentY, { width: 100 });
        } catch (e) {
            console.warn("No se pudo cargar el logo en el PDF");
        }
    }

    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary)
       .text(COMPANY.nombre, 150, currentY);
    
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.secondary)
        .text(`RUC: ${COMPANY.ruc}`, 150, currentY + 15)
        .text(COMPANY.direccion, 150, currentY + 30)
        .text(COMPANY.city, 150, currentY + 45)
        .text(`Tel: ${COMPANY.telefono}`, 150, currentY + 60);

    // Título Documento
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.primary)
       .text("ORDEN DE COMPRA", 250, currentY, { align: "right", width: 300 });
       
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.secondary)
       .text(`N° ${order.orderNumber}`, 250, currentY + 25, { align: "right", width: 300 })
       .text(`Fecha: ${formatDate(order.createdAt)}`, 250, currentY + 40, { align: "right", width: 300 });

    currentY += 90;
    generateHr(doc, currentY);
    currentY += 20;

    // ==========================================
    // 2. DATOS DEL CLIENTE Y ENVÍO
    // ==========================================
    const leftCol = 50;
    const rightCol = 320;
    
    // Obtenemos los datos del usuario poblado
    const user = order.user as unknown as IUser;
    const customerName = user && user.nombre ? `${user.nombre} ${user.apellidos || ''}` : "Cliente";
    const customerEmail = user && user.email ? user.email : "---";

    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted)
       .text("CLIENTE:", leftCol, currentY)
       .text("DETALLES DEL ENVÍO:", rightCol, currentY);
    
    currentY += 15;

    // Izquierda (Cliente)
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.primary)
       .text(customerName.trim(), leftCol, currentY);
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.secondary)
       .text(`Email: ${customerEmail}`, leftCol, currentY + 15)
       
       // Info de Pago
       .text(`Pago: `, leftCol, currentY + 35, { continued: true })
       .font("Helvetica-Bold").fillColor(COLORS.primary)
       .text(`${order.payment.provider} - ${order.payment.status.toUpperCase()}`);

    // Derecha (Envío)
    const ship = order.shippingAddress;
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.secondary)
       .text(`${ship.direccion}`, rightCol, currentY)
       .text(`${ship.distrito}, ${ship.provincia}, ${ship.departamento}`, rightCol, currentY + 15);
       
    if (ship.referencia) {
        doc.text(`Ref: ${ship.referencia}`, rightCol, currentY + 30, { width: 230 });
    }

    currentY += 80;

    // ==========================================
    // 3. TABLA DE PRODUCTOS
    // ==========================================
    doc.rect(50, currentY, 500, 24).fill(COLORS.surface);
    
    const colDesc = 60;
    const colCant = 300;
    const colPUnit = 380;
    const colSubtotal = 480;

    currentY += 8;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.secondary);
    doc.text("PRODUCTO", colDesc, currentY);
    doc.text("CANT.", colCant, currentY, { width: 40, align: "center" });
    doc.text("PRECIO", colPUnit, currentY, { width: 50, align: "right" });
    doc.text("IMPORTE", colSubtotal, currentY, { width: 60, align: "right" });

    currentY += 25;
    generateHr(doc, currentY - 8);

    doc.font("Helvetica").fillColor(COLORS.primary);

    order.items.forEach((item) => {
        if (currentY > 700) {
            doc.addPage();
            currentY = 50;
        }

        const importe = item.price * item.quantity;
        
        doc.text(item.nombre, colDesc, currentY, { width: 230, align: "left" });
        doc.text(item.quantity.toString(), colCant, currentY, { width: 40, align: "center" });
        doc.text(formatCurrency(item.price, order.currency), colPUnit, currentY, { width: 50, align: "right" });
        doc.text(formatCurrency(importe, order.currency), colSubtotal, currentY, { width: 60, align: "right" });

        // Pintar atributos de variante si existen (ej. "Color: Rojo")
        let attrOffset = 0;
        if (item.variantAttributes && Object.keys(item.variantAttributes).length > 0) {
             // En tu Schema pusiste variantAttributes: { type: Map, of: String },
             // Mongoose devuelve un objeto plano si usaste .lean() o JSON.parse.
             let attributesObj: Record<string, string> = {};
             
             // Manejo seguro por si Mongoose lo devuelve como un objeto o como una instancia de Map
             if (item.variantAttributes instanceof Map) {
                  attributesObj = Object.fromEntries(item.variantAttributes);
             } else {
                  attributesObj = item.variantAttributes as Record<string, string>;
             }

             const attrsString = Object.entries(attributesObj)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" | ");
             
             doc.font("Helvetica-Oblique").fontSize(8).fillColor(COLORS.muted)
                .text(attrsString, colDesc, currentY + 12, { width: 230 });
             doc.font("Helvetica").fontSize(9).fillColor(COLORS.primary); // Restaurar
             attrOffset = 15;
        }

        const textHeight = doc.heightOfString(item.nombre, { width: 230 });
        currentY += textHeight > 15 ? textHeight + 10 + attrOffset : 20 + attrOffset;

        generateHr(doc, currentY - 5);
    });

    currentY += 15;

    // ==========================================
    // 4. RESUMEN Y TOTALES
    // ==========================================
    if (currentY > 650) {
        doc.addPage();
        currentY = 50;
    }

    const summaryX = 350;
    const summaryValueX = 450;

    const drawSummaryLine = (label: string, value: string, yOffset: number, isBold: boolean = false) => {
        doc.font(isBold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor(isBold ? COLORS.primary : COLORS.secondary)
           .text(label, summaryX, currentY + yOffset, { width: 90, align: "right" })
           .text(value, summaryValueX, currentY + yOffset, { width: 90, align: "right" });
    };

    drawSummaryLine("Subtotal:", formatCurrency(order.subtotal, order.currency), 0);
    drawSummaryLine("Costo de Envío:", formatCurrency(order.shippingCost, order.currency), 20);
    
    // Línea separadora
    doc.strokeColor(COLORS.primary).lineWidth(1.5).moveTo(summaryX + 20, currentY + 40).lineTo(540, currentY + 40).stroke();

    // TOTAL FINAL
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.primary)
       .text("TOTAL:", summaryX, currentY + 50, { width: 90, align: "right" })
       .text(formatCurrency(order.totalPrice, order.currency), summaryValueX, currentY + 50, { width: 90, align: "right" });

    const footerY = doc.page.height - 80;
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(COLORS.muted)
       .text("Este documento es un comprobante de orden de compra y no representa un documento válido para efectos tributarios.", 
       50, footerY, { align: "center", width: 500 });
};