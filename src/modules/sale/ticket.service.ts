/* File: backend/src/modules/sale/ticket.service.ts */
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { ISale, SaleStatus } from '../../models/Sale';

interface LogoData {
  buffer: Buffer;
  aspectRatio: number;
}

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
  private readonly DIRECCION = 'Av. Mariscal Benavides 713 - Cañete, Perú';
  private readonly TELEFONO = 'Teléfono: 972 416 683';
  private readonly LOGO_URL = 'https://www.sycmobile.pe/logonegro.svg';

  private cachedLogo: LogoData | null = null;

  private async getLogoData(): Promise<LogoData | null> {
    if (this.cachedLogo) return this.cachedLogo;
    try {
      const response = await fetch(this.LOGO_URL);
      if (!response.ok) return null;
      const svgBuffer = Buffer.from(await response.arrayBuffer());

      // Procesamiento con transparencia pura (sin fondos ni bordes artificiales)
      const image = sharp(svgBuffer)
        .ensureAlpha()
        .png({ compressionLevel: 9, quality: 100 });

      const metadata = await image.metadata();
      const pngBuffer = await image.toBuffer();

      const width = metadata.width || 100;
      const height = metadata.height || 100;

      this.cachedLogo = {
        buffer: pngBuffer,
        aspectRatio: width / height,
      };
      return this.cachedLogo;
    } catch (error) {
      console.error('[TicketService] Error cargando logo:', error);
      return null;
    }
  }

  async generateTicketBuffer(sale: ISale): Promise<Buffer> {
    const isQuote = sale.isQuote || sale.status === SaleStatus.QUOTE;
    const logoData = await this.getLogoData();

    const logoWidth = 65;
    const logoHeight = logoData ? Math.round(logoWidth / logoData.aspectRatio) : 0;
    const logoSpacing = logoData ? logoHeight + 8 : 0;

    const headerHeight = (isQuote ? 145 : 140) + logoSpacing;
    const footerHeight = isQuote ? 155 : 150;
    const itemsLines = sale.items.reduce((acc, item) => acc + (item.variantId ? 2 : 1), 0);
    const tableHeight = 30 + itemsLines * 18;
    const totalHeight = Math.ceil(headerHeight + tableHeight + footerHeight);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [226, totalHeight],
        margins: { top: 10, left: 10, bottom: 10, right: 10 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      if (isQuote) {
        this.renderQuoteTicket(doc, sale, logoData, logoWidth, logoHeight);
      } else {
        this.renderSaleTicket(doc, sale, logoData, logoWidth, logoHeight);
      }

      doc.end();
    });
  }

  private renderSaleTicket(
    doc: PDFKit.PDFDocument,
    sale: ISale,
    logoData: LogoData | null,
    logoWidth: number,
    logoHeight: number
  ): void {
    doc.fillColor('#000000', 1.0);

    // 1. Logo centrado sin bordes
    if (logoData) {
      const logoX = 10 + (206 - logoWidth) / 2;
      doc.image(logoData.buffer, logoX, doc.y, { width: logoWidth, height: logoHeight });
      doc.y += logoHeight + 6;
    }

    // 2. Información Fiscal
    doc.font('Helvetica-Bold').fontSize(8.5).text(`RUC: ${this.RUC}`, 10, doc.y, { align: 'center', width: 206 });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(7).text(this.DIRECCION, 10, doc.y, { align: 'center', width: 206 });
    doc.text(this.TELEFONO, 10, doc.y, { align: 'center', width: 206 });
    doc.moveDown(0.4);

    this.drawDashedLine(doc);

    // 3. Comprobante
    const docTitle = sale.receiptType ? sale.receiptType.toUpperCase() : 'TICKET DE VENTA';
    doc.font('Helvetica-Bold').fontSize(9).text(`${docTitle}: ${sale.receiptNumber || '000000'}`, 10, doc.y, { align: 'center', width: 206 });
    doc.moveDown(0.3);

    // 4. Metadatos
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

    // 5. Tabla de Productos
    this.renderItemsTable(doc, sale);
    this.drawDashedLine(doc);

    // 6. Bloque de Totales
    if (sale.totalDiscountAmount > 0) {
      this.renderTotalLine(doc, 'SUBTOTAL', `S/ ${sale.subtotal.toFixed(2)}`, false);
      this.renderTotalLine(doc, 'DESCUENTO', `- S/ ${sale.totalDiscountAmount.toFixed(2)}`, false);
    }
    if (sale.totalSurchargeAmount > 0) {
      this.renderTotalLine(doc, 'RECARGO', `+ S/ ${sale.totalSurchargeAmount.toFixed(2)}`, false);
    }

    doc.moveDown(0.2);
    this.renderTotalLine(doc, 'TOTAL A PAGAR', `S/ ${sale.totalPrice.toFixed(2)}`, true);
    doc.moveDown(0.4);

    this.drawDashedLine(doc);
    doc.moveDown(0.3);

    // 7. Pie de Página
    doc.font('Helvetica-Bold').fontSize(8.5).text('¡GRACIAS POR SU COMPRA!', 10, doc.y, {
      align: 'center',
      width: 206,
    });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(6.5).text('Verifique su producto y cambio antes de retirarse.', 10, doc.y, {
      align: 'center',
      width: 206,
    });
    doc.moveDown(0.15);
    doc.text('Para cualquier reclamo o garantía conserve este ticket.', 10, doc.y, {
      align: 'center',
      width: 206,
    });
  }

  private renderQuoteTicket(
    doc: PDFKit.PDFDocument,
    sale: ISale,
    logoData: LogoData | null,
    logoWidth: number,
    logoHeight: number
  ): void {
    doc.fillColor('#000000', 1.0);

    if (logoData) {
      const logoX = 10 + (206 - logoWidth) / 2;
      doc.image(logoData.buffer, logoX, doc.y, { width: logoWidth, height: logoHeight });
      doc.y += logoHeight + 6;
    }

    doc.font('Helvetica-Bold').fontSize(10).text('COTIZACIÓN / PROFORMA', 10, doc.y, { align: 'center', width: 206 });
    doc.moveDown(0.2);
    doc.font('Helvetica').fontSize(7.5).text(`RUC: ${this.RUC}`, 10, doc.y, { align: 'center', width: 206 });
    doc.fontSize(6.5).text(this.DIRECCION, 10, doc.y, { align: 'center', width: 206 });
    doc.text(this.TELEFONO, 10, doc.y, { align: 'center', width: 206 });
    doc.moveDown(0.3);

    this.drawDashedLine(doc);

    doc.font('Helvetica-Bold').fontSize(8.5).text(`CÓDIGO: ${sale.receiptNumber || 'PROFORMA'}`, 10, doc.y, { align: 'center', width: 206 });
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
    doc.moveDown(0.4);

    this.drawDashedLine(doc);
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(6.5).text('CONDICIONES COMERCIALES:', 10, doc.y, { align: 'left', width: 206 });
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

    doc.font('Helvetica-Bold').fontSize(7);
    doc.text('CANT', colCantX, currentY);
    doc.text('DESCRIPCIÓN', colDescX, currentY);
    doc.text('TOTAL', colTotalX, currentY, { width: colTotalWidth, align: 'right' });

    currentY += 10;
    doc.y = currentY;

    doc.save().lineWidth(0.5).strokeColor('#CCCCCC');
    doc.moveTo(10, currentY - 2).lineTo(216, currentY - 2).stroke().restore();

    doc.font('Helvetica').fontSize(7);

    sale.items.forEach((item: any) => {
      currentY = doc.y;
      const lineTotal = (item.price * item.quantity - (item.discount || 0)).toFixed(2);
      const rawName = item.product?.nombre || 'Producto';
      const name = rawName.length > 22 ? rawName.substring(0, 20) + '..' : rawName;

      doc.text(item.quantity.toString(), colCantX, currentY);
      doc.text(name, colDescX, currentY, { width: 118 });
      doc.text(`S/ ${lineTotal}`, colTotalX, currentY, { width: colTotalWidth, align: 'right' });

      doc.y += 10;

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
      doc.y += 13;
    } else {
      doc.font('Helvetica').fontSize(7.5).text(label, 10, y, { width: 110, align: 'left' });
      doc.text(amount, 120, y, { width: 96, align: 'right' });
      doc.y += 10;
    }
    doc.x = 10;
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

    doc.x = 10;
    doc.moveDown(0.3);
  }
}