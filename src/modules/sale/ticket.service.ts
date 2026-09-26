/* File: backend/src/modules/sale/ticket.service.ts */
import PDFDocument from 'pdfkit';
import { ISale, SaleStatus } from '../../models/Sale';

function formatPeruDateTime(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

function formatPeruDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export class TicketService {
  private readonly RUC = '10725009858';
  private readonly RAZON_SOCIAL = 'SYC Mobile Perú';
  private readonly DIRECCION = 'Av. Mariscal Benavides 713 - Cañete, Perú';
  private readonly TELEFONO = 'Teléfono: 972 416 683';

  async generateTicketBuffer(sale: ISale): Promise<Buffer> {
    const isQuote = sale.isQuote || sale.status === SaleStatus.QUOTE;

    // Encabezado institucional + datos cliente
    const headerHeight = isQuote ? 170 : 165;
    // Totales + subtotales + pie de página
    const footerHeight = isQuote ? 140 : 135;
    // 1 línea por producto + 1 si tiene variante
    const itemsLines = sale.items.reduce((acc, item) => acc + (item.variantId ? 2 : 1), 0);
    const tableHeight = 28 + itemsLines * 18;
    const totalHeight = Math.ceil(headerHeight + tableHeight + footerHeight);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [226, totalHeight],
        margins: { top: 8, left: 10, bottom: 8, right: 10 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      if (isQuote) {
        this.renderQuoteTicket(doc, sale);
      } else {
        this.renderSaleTicket(doc, sale);
      }

      doc.end();
    });
  }

  private renderSaleTicket(doc: PDFKit.PDFDocument, sale: ISale): void {
    // 1. Encabezado de Empresa
    doc.fillColor('#000000', 1.0);
    doc.font('Helvetica-Bold').fontSize(11).text(this.RAZON_SOCIAL, { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(8).text(`RUC: ${this.RUC}`, { align: 'center' });
    doc.font('Helvetica').fontSize(7).text(this.DIRECCION, { align: 'center', width: 206 });
    doc.text(this.TELEFONO, { align: 'center', width: 206 });
    doc.moveDown(0.4);

    this.drawDashedLine(doc);

    // 2. Título de Comprobante y Número Correlativo
    const docTitle = sale.receiptType ? sale.receiptType.toUpperCase() : 'TICKET DE VENTA';
    doc.font('Helvetica-Bold').fontSize(9).text(`${docTitle}: ${sale.receiptNumber || '000000'}`, { align: 'center' });
    doc.moveDown(0.3);

    // 3. Metadatos de la Venta (Alineación con dos puntos uniformes)
    doc.font('Helvetica').fontSize(7);
    this.renderKeyValue(doc, 'Fecha y Hora', formatPeruDateTime(sale.createdAt));
    this.renderKeyValue(doc, 'Cajero/Op.', (sale.employee as any)?.nombre || 'Cajero');
    this.renderKeyValue(doc, 'Método de Pago', sale.paymentMethod || 'EFECTIVO');
    
    const clientName = sale.customerSnapshot?.nombre || 'CLIENTES VARIOS';
    this.renderKeyValue(doc, 'Cliente', clientName);
    
    if (sale.customerSnapshot?.numeroDocumento) {
      const docType = sale.customerSnapshot.tipoDocumento || 'DOC';
      this.renderKeyValue(doc, docType, sale.customerSnapshot.numeroDocumento);
    }

    doc.moveDown(0.3);
    this.drawDashedLine(doc);

    // 4. Tabla de Productos
    this.renderItemsTable(doc, sale);
    this.drawDashedLine(doc);

    // 5. Bloque de Totales
    if (sale.totalDiscountAmount > 0) {
      this.renderTotalLine(doc, 'SUBTOTAL', `S/ ${sale.subtotal.toFixed(2)}`, false);
      this.renderTotalLine(doc, 'DESCUENTO', `- S/ ${sale.totalDiscountAmount.toFixed(2)}`, false);
    }
    if (sale.totalSurchargeAmount > 0) {
      this.renderTotalLine(doc, 'RECARGO', `+ S/ ${sale.totalSurchargeAmount.toFixed(2)}`, false);
    }

    doc.moveDown(0.2);
    this.renderTotalLine(doc, 'TOTAL A PAGAR', `S/ ${sale.totalPrice.toFixed(2)}`, true);
    doc.moveDown(0.6);

    // 6. Mensaje de Despedida y Garantía
    doc.font('Helvetica-Bold').fontSize(8).text('¡GRACIAS POR SU COMPRA!', { align: 'center' });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(6).text('Verifique su producto y cambio antes de retirarse.', { align: 'center', width: 206 });
    doc.text('Para cualquier reclamo o garantía, presente este ticket.', { align: 'center', width: 206 });
  }

  private renderQuoteTicket(doc: PDFKit.PDFDocument, sale: ISale): void {
    doc.fillColor('#000000', 1.0);
    doc.font('Helvetica-Bold').fontSize(10).text('COTIZACIÓN / PROFORMA', { align: 'center' });
    doc.moveDown(0.2);
    doc.fontSize(9).text(this.RAZON_SOCIAL, { align: 'center' });
    doc.font('Helvetica').fontSize(7.5).text(`RUC: ${this.RUC}`, { align: 'center' });
    doc.fontSize(6.5).text(this.DIRECCION, { align: 'center', width: 206 });
    doc.text(this.TELEFONO, { align: 'center', width: 206 });
    doc.moveDown(0.3);

    this.drawDashedLine(doc);

    doc.font('Helvetica-Bold').fontSize(8.5).text(`CÓDIGO: ${sale.receiptNumber || 'PROFORMA'}`, { align: 'center' });
    doc.moveDown(0.3);

    doc.font('Helvetica').fontSize(7);
    this.renderKeyValue(doc, 'Fecha y Hora', formatPeruDateTime(sale.createdAt));
    if (sale.quoteExpirationDate) {
      this.renderKeyValue(doc, 'Válido Hasta', formatPeruDate(sale.quoteExpirationDate));
    }
    this.renderKeyValue(doc, 'Atendido por', (sale.employee as any)?.nombre || 'Asesor');
    this.renderKeyValue(doc, 'Cliente', sale.customerSnapshot?.nombre || 'General');
    if (sale.customerSnapshot?.numeroDocumento) {
      this.renderKeyValue(doc, 'Doc. Identidad', sale.customerSnapshot.numeroDocumento);
    }

    doc.moveDown(0.3);
    this.drawDashedLine(doc);
    this.renderItemsTable(doc, sale);
    this.drawDashedLine(doc);

    doc.moveDown(0.2);
    this.renderTotalLine(doc, 'TOTAL ESTIMADO', `S/ ${sale.totalPrice.toFixed(2)}`, true);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(6.5).text('CONDICIONES COMERCIALES:', 10, doc.y, { align: 'left' });
    doc.font('Helvetica').fontSize(6);
    doc.text('• Precios y stock sujetos a variación sin previo aviso.', 10, doc.y + 2, { width: 206 });
    doc.text('• Documento informativo no válido como comprobante fiscal SUNAT.', 10, doc.y + 1, { width: 206 });
    doc.text('• La reserva de productos se confirma tras la emisión de boleta/factura.', 10, doc.y + 1, { width: 206 });
  }

  private renderItemsTable(doc: PDFKit.PDFDocument, sale: ISale): void {
    const colCantX = 10;
    const colDescX = 32;
    const colTotalX = 152;
    const colTotalWidth = 64;

    let currentY = doc.y;

    // Encabezado de Columnas
    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('CANT', colCantX, currentY);
    doc.text('DESCRIPCIÓN', colDescX, currentY);
    doc.text('TOTAL', colTotalX, currentY, { width: colTotalWidth, align: 'right' });

    currentY += 10;
    doc.y = currentY;

    // Línea continua sutil bajo encabezado
    doc.save().lineWidth(0.5).strokeColor('#CCCCCC');
    doc.moveTo(10, currentY - 2).lineTo(216, currentY - 2).stroke().restore();

    doc.font('Helvetica').fontSize(7);

    // Listado de Artículos
    sale.items.forEach((item: any) => {
      currentY = doc.y;
      const lineTotal = (item.price * item.quantity - (item.discount || 0)).toFixed(2);
      const rawName = item.product?.nombre || 'Producto';
      const name = rawName.length > 22 ? rawName.substring(0, 20) + '..' : rawName;

      doc.text(item.quantity.toString(), colCantX, currentY);
      doc.text(name, colDescX, currentY, { width: 118 });
      doc.text(`S/ ${lineTotal}`, colTotalX, currentY, { width: colTotalWidth, align: 'right' });

      doc.y += 10;

      // Variante subordinada
      if (item.variantId && item.product?.variants) {
        const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
        if (variant) {
          doc.fontSize(6).font('Helvetica-Oblique').text(`  [Var: ${variant.nombre}]`, colDescX, doc.y);
          doc.fontSize(7).font('Helvetica');
          doc.y += 8;
        }
      }
    });

    doc.moveDown(0.2);
  }

  private renderKeyValue(doc: PDFKit.PDFDocument, label: string, value: string): void {
    const y = doc.y;
    doc.font('Helvetica-Bold').text(`${label}:`, 10, y, { width: 65 });
    doc.font('Helvetica').text(value, 75, y, { width: 141, align: 'left' });
    doc.y += 9;
  }

  private renderTotalLine(doc: PDFKit.PDFDocument, label: string, amount: string, isBig: boolean): void {
    const y = doc.y;
    if (isBig) {
      doc.font('Helvetica-Bold').fontSize(9.5).text(label, 10, y, { width: 110, align: 'left' });
      doc.text(amount, 120, y, { width: 96, align: 'right' });
      doc.y += 12;
    } else {
      doc.font('Helvetica').fontSize(7.5).text(label, 10, y, { width: 110, align: 'left' });
      doc.text(amount, 120, y, { width: 96, align: 'right' });
      doc.y += 10;
    }
  }

  private drawDashedLine(doc: PDFKit.PDFDocument): void {
    const y = doc.y;
    doc
      .save()
      .dash(2, { space: 2 })
      .lineWidth(0.5)
      .strokeColor('#888888')
      .moveTo(10, y)
      .lineTo(216, y)
      .stroke()
      .undash()
      .restore();

    doc.moveDown(0.3);
  }
}