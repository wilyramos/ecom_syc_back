import { ISale } from "../models/Sale";

const COMPANY = {
    nombre: "GOPHONE",
    ruc: "1072516715",
    direccion: "Jr. Bernardo Ohggins 120",
    city: "Cañete, Lima - Perú",
    telefono: "972416683",
};


const formatCurrency = (value: number) => `S/ ${value.toFixed(2)}`;
const formatDate = (date?: Date | string) => {
    if (!date) return new Date().toLocaleString('es-PE');
    return new Date(date).toLocaleString('es-PE');
};

// Se añade el parámetro logoPath para inyectar la imagen
export const generateSalePDF = (doc: PDFKit.PDFDocument, sale: ISale, logoPath?: string) => {
    // --- CABECERA ---
    if (logoPath) {
        // Inserta el logo. Ajusta width y las coordenadas (x, y) según proporciones.
        doc.image(logoPath, 50, 40, { width: 80 });
    }

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000000").text(COMPANY.nombre, 150, 50);
    doc.font("Helvetica").fontSize(9)
        .text(`RUC: ${COMPANY.ruc}`, 150, 65)
        .text(COMPANY.direccion, 150, 80)
        .text(COMPANY.city, 150, 95)
        .text(`Tel: ${COMPANY.telefono}`, 150, 110);

    // Caja de Comprobante (Estilo punteado similar a la imagen)
    doc.rect(360, 45, 185, 45).dash(2, { space: 2 }).strokeColor("#A0A0A0").stroke();
    doc.undash(); // Restablecer trazo para el resto del documento
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000")
        .text("NOTA DE VENTA", 360, 55, { width: 185, align: "center" })
        .text(`${sale.receiptNumber || "000000"}`, 360, 70, { width: 185, align: "center" });

    // --- DATOS DEL CLIENTE ---
    const startY = 130;
    const leftCol = 50;
    const rightCol = 320;
    const c = sale.customerSnapshot || {};

    const detailLine = (label: string, value: string, x: number, y: number) => {
        doc.font("Helvetica-Bold").fontSize(9).text(`${label}: `, x, y, { continued: true })
            .font("Helvetica").text(value || "-");
    };

    detailLine("Cliente", c.nombre || "Cliente General", leftCol, startY);
    detailLine("Celular", c.telefono || "", leftCol, startY + 15);
    detailLine("Dirección", c.direccion || "", leftCol, startY + 30);
    detailLine("Tipo de envío", sale.deliveryMethod || "PICKUP", leftCol, startY + 45);

    detailLine("Fecha de emisión", formatDate(sale.createdAt), rightCol, startY);
    detailLine("Documento", `${c.tipoDocumento || 'DNI'}: ${c.numeroDocumento || ''}`, rightCol, startY + 15);

    // Si employee está poblado en la consulta (populate), se extrae el nombre
    const employeeName = typeof sale.employee === 'object' && sale.employee !== null && 'nombre' in sale.employee
        ? (sale.employee as any).nombre
        : "Vendedor Web";
    detailLine("Vendedor", employeeName, rightCol, startY + 30);

    // --- TABLA DE PRODUCTOS ---
    let tableY = startY + 80;

    // Fondo gris claro para la cabecera de la tabla
    doc.rect(50, tableY, 495, 18).fill("#F3F4F6");
    doc.fillColor("#000000");

    const colProducto = 55;
    const colCant = 320;
    const colPUnit = 370;
    const colDto = 430;
    const colSubtotal = 480;

    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Producto", colProducto, tableY + 5);
    doc.text("Cant.", colCant, tableY + 5, { width: 40, align: "right" });
    doc.text("P. Unit.", colPUnit, tableY + 5, { width: 50, align: "right" });
    doc.text("Dto%", colDto, tableY + 5, { width: 40, align: "right" });
    doc.text("Subtotal", colSubtotal, tableY + 5, { width: 60, align: "right" });

    let currentY = tableY + 25;
    doc.font("Helvetica").fontSize(9);

    sale.items.forEach((item) => {
        const importe = item.price * item.quantity;
        const nombre = typeof item.product === "object" && item.product !== null && 'nombre' in item.product
            ? (item.product as any).nombre
            : "Producto";

        doc.text(nombre, colProducto, currentY, { width: 250 });
        doc.text(item.quantity.toFixed(1), colCant, currentY, { width: 40, align: "right" });
        doc.text(formatCurrency(item.price), colPUnit, currentY, { width: 50, align: "right" });
        doc.text("0%", colDto, currentY, { width: 40, align: "right" }); // El Schema ISaleItem no tiene descuento individual
        doc.text(formatCurrency(importe), colSubtotal, currentY, { width: 60, align: "right" });

        // Calcular altura dinámica por si el nombre del producto usa múltiples líneas
        const textHeight = doc.heightOfString(nombre, { width: 250 });
        currentY += textHeight > 15 ? textHeight + 8 : 20;
    });

    // --- FOOTER (PAGOS Y RESUMEN) ---
    currentY += 20;

    const subtotal = sale.totalPrice / 1.18;
    const igv = sale.totalPrice - subtotal;
    const totalDiscount = sale.totalDiscountAmount || 0;

    // Columna Izquierda: PAGOS
    doc.font("Helvetica-Bold").text("PAGOS", leftCol, currentY);
    doc.font("Helvetica");

    doc.text(sale.paymentMethod, leftCol, currentY + 15);
    doc.text(formatCurrency(sale.totalPrice), leftCol + 150, currentY + 15, { width: 60, align: "right" });

    doc.font("Helvetica-Bold").text("Monto total", leftCol, currentY + 30);
    doc.font("Helvetica").text(formatCurrency(sale.totalPrice), leftCol + 150, currentY + 30, { width: 60, align: "right" });

    doc.font("Helvetica-Bold").text("Monto a cobrar", leftCol, currentY + 45);
    doc.font("Helvetica").text(formatCurrency(0), leftCol + 150, currentY + 45, { width: 60, align: "right" });

    // Columna Derecha: RESUMEN
    const resumeColLabel = rightCol;
    const resumeColValue = rightCol + 120;

    doc.font("Helvetica-Bold").text("RESUMEN", resumeColLabel, currentY);

    doc.font("Helvetica-Bold").text("Descuento total", resumeColLabel, currentY + 15);
    doc.font("Helvetica").text(formatCurrency(totalDiscount), resumeColValue, currentY + 15, { width: 105, align: "right" });

    doc.font("Helvetica-Bold").text("Subtotal", resumeColLabel, currentY + 30);
    doc.font("Helvetica").text(formatCurrency(subtotal), resumeColValue, currentY + 30, { width: 105, align: "right" });

    doc.font("Helvetica-Bold").text("Impuestos", resumeColLabel, currentY + 45);
    doc.font("Helvetica").text(formatCurrency(igv), resumeColValue, currentY + 45, { width: 105, align: "right" });

    doc.font("Helvetica-Bold").text("Monto total", resumeColLabel, currentY + 60);
    doc.font("Helvetica").text(formatCurrency(sale.totalPrice), resumeColValue, currentY + 60, { width: 105, align: "right" });

    // Mensaje Final
    doc.font("Helvetica-Oblique").text("Gracias por confiar en GoPhone.", 50, currentY + 100, { align: "center", width: 495 });
};