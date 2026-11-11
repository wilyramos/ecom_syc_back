/* File: backend/src/modules/sale/ticket.service.ts */
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { ISale, SaleStatus } from '../../models/Sale';

interface LogoData {
  buffer: Buffer;
  aspectRatio: number;
}

const TICKET_WIDTH = 226;
const TICKET_MARGINS = { top: 0, left: 8, bottom: 0, right: 8 };
const CONTENT_WIDTH = 210;
const KV_LINE_HEIGHT = 7;      // Interlineado de clave-valor (antes 7.5)
const DASHED_LINE_GAP = 1.5;   // Espacio después de la línea punteada (antes 3)
const BOTTOM_PADDING = 4;      // Colchón para que el último renglón no se corte

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

    const logoWidth = 55;
    const logoHeight = logoData ? Math.round(logoWidth / logoData.aspectRatio) : 0;

    const renderContent = (doc: PDFKit.PDFDocument) => {
      if (isQuote) {
        this.renderQuoteTicket(doc, sale, logoData, logoWidth, logoHeight);
      } else {
        this.renderSaleTicket(doc, sale, logoData, logoWidth, logoHeight);
      }
    };

    // Pasada 1: medir la altura real del contenido
    const measureDoc = new PDFDocument({
      size: [TICKET_WIDTH, 3000],
      margins: TICKET_MARGINS,
    });
    renderContent(measureDoc);
    const contentHeight = measureDoc.y;
    measureDoc.end();

    // Pasada 2: generar el PDF con la altura exacta
    const totalHeight = Math.ceil(contentHeight + BOTTOM_PADDING);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: [TICKET_WIDTH, totalHeight],
        margins: TICKET_MARGINS,
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      renderContent(doc);
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

    // 1. Logo
    if (logoData) {
      const logoX = 8 + (CONTENT_WIDTH - logoWidth) / 2;
      doc.image(logoData.buffer, logoX, doc.y, { width: logoWidth, height: logoHeight });
      doc.y += logoHeight + 2;
    }

    // 2. Información fiscal
    doc.font('Helvetica-Bold').fontSize(7.5).text(`RUC: ${this.RUC}`, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(6).text(this.DIRECCION, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.text(this.TELEFONO, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.y += 2;

    this.drawDashedLine(doc);

    // 3. Comprobante
    const docTitle = sale.receiptType ? sale.receiptType.toUpperCase() : 'TICKET';
    doc.font('Helvetica-Bold').fontSize(8).text(`${docTitle}: ${sale.receiptNumber || '000000'}`, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.y += 2;

    // 4. Metadatos compactos
    this.renderKeyValue(doc, 'Fecha/Hora', formatPeruDateTime(sale.createdAt));
    this.renderKeyValue(doc, 'Cajero', (sale.employee as any)?.nombre || 'Cajero');
    this.renderKeyValue(doc, 'Pago', sale.paymentMethod || 'EFECTIVO');
    this.renderKeyValue(doc, 'Cliente', sale.customerSnapshot?.nombre || 'CLIENTES VARIOS');

    if (sale.customerSnapshot?.numeroDocumento) {
      const docType = sale.customerSnapshot.tipoDocumento || 'DOC';
      this.renderKeyValue(doc, docType, sale.customerSnapshot.numeroDocumento);
    }

    this.drawDashedLine(doc);

    // 5. Tabla de productos
    this.renderItemsTable(doc, sale);
    this.drawDashedLine(doc);

    // 6. Totales
    if (sale.totalDiscountAmount > 0) {
      this.renderTotalLine(doc, 'SUBTOTAL', `S/ ${sale.subtotal.toFixed(2)}`, false);
      this.renderTotalLine(doc, 'DCTO', `- S/ ${sale.totalDiscountAmount.toFixed(2)}`, false);
    }
    if (sale.totalSurchargeAmount > 0) {
      this.renderTotalLine(doc, 'RECARGO', `+ S/ ${sale.totalSurchargeAmount.toFixed(2)}`, false);
    }

    doc.y += 1;
    this.renderTotalLine(doc, 'TOTAL', `S/ ${sale.totalPrice.toFixed(2)}`, true);

    doc.y += 2;
    this.drawDashedLine(doc);

    // 7. Pie de página
    doc.font('Helvetica-Bold').fontSize(7.5).text('¡GRACIAS POR SU COMPRA!', 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(6).text('Verifique su producto y cambio.', 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.text('Para reclamos/garantía conserve este ticket.', 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
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
      const logoX = 8 + (CONTENT_WIDTH - logoWidth) / 2;
      doc.image(logoData.buffer, logoX, doc.y, { width: logoWidth, height: logoHeight });
      doc.y += logoHeight + 2;
    }

    doc.font('Helvetica-Bold').fontSize(8.5).text('COTIZACIÓN', 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(6).text(`RUC: ${this.RUC} | ${this.TELEFONO}`, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.text(this.DIRECCION, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.y += 2;

    this.drawDashedLine(doc);

    doc.font('Helvetica-Bold').fontSize(8).text(`CÓDIGO: ${sale.receiptNumber || 'PROFORMA'}`, 8, doc.y, { align: 'center', width: CONTENT_WIDTH });
    doc.y += 2;

    this.renderKeyValue(doc, 'Fecha', formatPeruDateTime(sale.createdAt));
    if (sale.quoteExpirationDate) {
      this.renderKeyValue(doc, 'Válido Hasta', formatPeruDate(sale.quoteExpirationDate));
    }
    this.renderKeyValue(doc, 'Asesor', (sale.employee as any)?.nombre || 'Asesor');
    this.renderKeyValue(doc, 'Cliente', sale.customerSnapshot?.nombre || 'General');
    if (sale.customerSnapshot?.numeroDocumento) {
      this.renderKeyValue(doc, 'Doc.', sale.customerSnapshot.numeroDocumento);
    }

    this.drawDashedLine(doc);
    this.renderItemsTable(doc, sale);
    this.drawDashedLine(doc);

    doc.y += 1;
    this.renderTotalLine(doc, 'TOTAL EST.', `S/ ${sale.totalPrice.toFixed(2)}`, true);

    doc.y += 2;
    this.drawDashedLine(doc);

    doc.font('Helvetica-Bold').fontSize(6).text('CONDICIONES:', 8, doc.y, { align: 'left', width: CONTENT_WIDTH });
    doc.font('Helvetica').fontSize(5.5);
    doc.text('• Precios/stock sujetos a variación sin aviso.', 8, doc.y, { width: CONTENT_WIDTH });
    doc.text('• No válido como comprobante fiscal.', 8, doc.y, { width: CONTENT_WIDTH });
    doc.text('• Reserva confirmada tras boleta/factura.', 8, doc.y, { width: CONTENT_WIDTH });
  }

  private renderItemsTable(doc: PDFKit.PDFDocument, sale: ISale): void {
    const colCantX = 8;
    const colDescX = 26;
    const colTotalX = 160;
    const colTotalWidth = 58;

    let currentY = doc.y;

    doc.font('Helvetica-Bold').fontSize(6.5);
    doc.text('CANT', colCantX, currentY);
    doc.text('DESCRIPCIÓN', colDescX, currentY);
    doc.text('TOTAL', colTotalX, currentY, { width: colTotalWidth, align: 'right' });

    currentY += 8;
    doc.y = currentY;

    // Línea separadora del encabezado
    doc.save().lineWidth(0.3).strokeColor('#EEEEEE');
    doc.moveTo(8, currentY - 1).lineTo(218, currentY - 1).stroke().restore();

    doc.font('Helvetica').fontSize(6.5);

    sale.items.forEach((item: any) => {
      currentY = doc.y;
      const lineTotal = (item.price * item.quantity - (item.discount || 0)).toFixed(2);
      const rawName = item.product?.nombre || 'Producto';
      const name = rawName.length > 25 ? rawName.substring(0, 23) + '..' : rawName;

      doc.text(item.quantity.toString(), colCantX, currentY);
      doc.text(name, colDescX, currentY, { width: 130 });
      doc.text(`S/ ${lineTotal}`, colTotalX, currentY, { width: colTotalWidth, align: 'right' });

      doc.y = currentY + 8;

      if (item.variantId && item.product?.variants) {
        const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
        if (variant) {
          doc.fontSize(5.5).font('Helvetica-Oblique').text(`[V: ${variant.nombre}]`, colDescX, doc.y);
          doc.fontSize(6.5).font('Helvetica');
          doc.y += 6;
        }
      }
    });

    doc.x = 8;
    doc.y += 2;
  }

  private renderKeyValue(doc: PDFKit.PDFDocument, label: string, value: string): void {
    const y = doc.y;

    doc.font('Helvetica-Bold').fontSize(6.5).text(`${label}:`, 8, y, { width: 45, lineGap: 0 });
    doc.font('Helvetica').fontSize(6.5).text(value, 55, y, { width: 163, align: 'left', lineGap: 0 });

    doc.x = 8;
    doc.y = y + KV_LINE_HEIGHT;
  }

  private renderTotalLine(doc: PDFKit.PDFDocument, label: string, amount: string, isBig: boolean): void {
    const y = doc.y;
    if (isBig) {
      doc.font('Helvetica-Bold').fontSize(8.5).text(label, 8, y, { width: 110, align: 'left' });
      doc.text(amount, 120, y, { width: 98, align: 'right' });
      doc.y = y + 10;
    } else {
      doc.font('Helvetica').fontSize(7).text(label, 8, y, { width: 110, align: 'left' });
      doc.text(amount, 120, y, { width: 98, align: 'right' });
      doc.y = y + 8;
    }
    doc.x = 8;
  }

  private drawDashedLine(doc: PDFKit.PDFDocument): void {
    const y = doc.y;
    doc
      .save()
      .dash(1, { space: 1 })
      .lineWidth(0.3)
      .strokeColor('#AAAAAA')
      .moveTo(8, y)
      .lineTo(218, y)
      .stroke()
      .undash()
      .restore();

    doc.x = 8;
    doc.y = y + DASHED_LINE_GAP;
  }
}