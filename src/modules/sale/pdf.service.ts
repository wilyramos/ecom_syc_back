/* File: backend/src/modules/sale/pdf.service.ts */
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

export class PdfService {
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
      console.error('[PdfService] Error cargando logo A4:', error);
      return null;
    }
  }

  async generateA4Buffer(sale: ISale): Promise<Buffer> {
    const isQuote = sale.isQuote || sale.status === SaleStatus.QUOTE;
    const logoData = await this.getLogoData();

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, left: 40, bottom: 40, right: 40 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- 1. CABECERA CON LOGO (SIN BORDES) ---
      const logoWidth = 85;
      let textStartY = 40;

      if (logoData) {
        const logoHeight = Math.round(logoWidth / logoData.aspectRatio);
        doc.image(logoData.buffer, 40, 40, { width: logoWidth, height: logoHeight });
        textStartY = 40 + logoHeight + 8;
      }

      doc.fillColor('#000000');
      doc.font('Helvetica-Bold').fontSize(8.5).text(this.DIRECCION, 40, textStartY);
      doc.font('Helvetica').fontSize(8).text(this.TELEFONO, 40, textStartY + 13);

      // Recuadro SUNAT (Derecha superior)
      doc.rect(380, 40, 175, 75).lineWidth(1.5).strokeColor('#000000').stroke();
      doc.font('Helvetica-Bold').fontSize(11).text(`R.U.C. ${this.RUC}`, 380, 52, { width: 175, align: 'center' });
      const docName = isQuote ? 'COTIZACIÓN / PROFORMA' : (sale.receiptType || 'BOLETA ELECTRÓNICA');
      doc.fontSize(10).text(docName, 380, 70, { width: 175, align: 'center' });
      doc.fontSize(12).text(`N° ${sale.receiptNumber || '000000'}`, 380, 88, { width: 175, align: 'center' });

      // --- 2. DATOS DEL CLIENTE ---
      const clientBoxY = Math.max(textStartY + 32, 130);
      doc.rect(40, clientBoxY, 515, 58).lineWidth(0.5).strokeColor('#CCCCCC').stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).text('Cliente:', 50, clientBoxY + 10);
      doc.font('Helvetica').text(sale.customerSnapshot?.nombre || 'CLIENTES VARIOS', 110, clientBoxY + 10);

      doc.font('Helvetica-Bold').text('Documento:', 50, clientBoxY + 24);
      const docId = `${sale.customerSnapshot?.tipoDocumento || 'DOC'}: ${sale.customerSnapshot?.numeroDocumento || '-'}`;
      doc.font('Helvetica').text(docId, 110, clientBoxY + 24);

      doc.font('Helvetica-Bold').text('Fecha Emisión:', 340, clientBoxY + 10);
      doc.font('Helvetica').text(formatPeruDateTime(sale.createdAt), 420, clientBoxY + 10);

      if (isQuote && sale.quoteExpirationDate) {
        doc.font('Helvetica-Bold').text('Fecha Venc.:', 340, clientBoxY + 24);
        doc.font('Helvetica').text(formatPeruDate(sale.quoteExpirationDate), 420, clientBoxY + 24);
      } else {
        doc.font('Helvetica-Bold').text('Forma de Pago:', 340, clientBoxY + 24);
        doc.font('Helvetica').text(sale.paymentMethod || 'CONTADO', 420, clientBoxY + 24);
      }

      doc.font('Helvetica-Bold').text('Atendido por:', 50, clientBoxY + 38);
      doc.font('Helvetica').text((sale.employee as any)?.nombre || 'Asesor Comercial', 110, clientBoxY + 38);

      // --- 3. TABLA DE PRODUCTOS ---
      let tableY = clientBoxY + 70;
      doc.rect(40, tableY, 515, 20).fillColor('#F2F2F2').fill();
      doc.fillColor('#000000');

      doc.font('Helvetica-Bold').fontSize(8.5);
      doc.text('ITEM', 45, tableY + 6);
      doc.text('CANT.', 75, tableY + 6);
      doc.text('DESCRIPCIÓN DEL PRODUCTO', 120, tableY + 6);
      doc.text('P. UNIT.', 400, tableY + 6, { width: 70, align: 'right' });
      doc.text('TOTAL', 480, tableY + 6, { width: 70, align: 'right' });

      tableY += 20;
      doc.font('Helvetica').fontSize(8);

      sale.items.forEach((item: any, idx: number) => {
        const lineTotal = (item.price * item.quantity - (item.discount || 0)).toFixed(2);
        const productName = item.product?.nombre || 'Producto';

        doc.text((idx + 1).toString(), 45, tableY + 6);
        doc.text(item.quantity.toString(), 75, tableY + 6);
        doc.text(productName, 120, tableY + 6, { width: 270 });
        doc.text(`S/ ${item.price.toFixed(2)}`, 400, tableY + 6, { width: 70, align: 'right' });
        doc.text(`S/ ${lineTotal}`, 480, tableY + 6, { width: 70, align: 'right' });

        tableY += 18;

        if (item.variantId && item.product?.variants) {
          const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
          if (variant) {
            doc.fontSize(7).font('Helvetica-Oblique').text(`   Variante: ${variant.nombre}`, 120, tableY + 2);
            doc.fontSize(8).font('Helvetica');
            tableY += 12;
          }
        }

        doc.moveTo(40, tableY + 2).lineTo(555, tableY + 2).lineWidth(0.5).strokeColor('#EEEEEE').stroke();
      });

      // --- 4. TOTALES ---
      let totalsY = Math.max(tableY + 20, 360);

      if (sale.totalDiscountAmount > 0) {
        doc.font('Helvetica').fontSize(8.5).text('SUBTOTAL:', 380, totalsY, { width: 90, align: 'right' });
        doc.text(`S/ ${sale.subtotal.toFixed(2)}`, 480, totalsY, { width: 70, align: 'right' });
        totalsY += 15;

        doc.text('DESCUENTO:', 380, totalsY, { width: 90, align: 'right' });
        doc.text(`- S/ ${sale.totalDiscountAmount.toFixed(2)}`, 480, totalsY, { width: 70, align: 'right' });
        totalsY += 15;
      }

      doc.rect(380, totalsY, 175, 25).fillColor('#000000').fill();
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10);
      doc.text('TOTAL A PAGAR:', 390, totalsY + 7);
      doc.text(`S/ ${sale.totalPrice.toFixed(2)}`, 470, totalsY + 7, { width: 80, align: 'right' });

      // --- 5. notas generales y gracias ---
      doc.fillColor('#000000');
      const footerY = totalsY + 45;
      doc.font('Helvetica-Bold').fontSize(8).text('sycmobile.pe', 40, footerY);
      doc.font('Helvetica').fontSize(7.5);

      if (isQuote) {
        doc.text('• Precios expresados en Soles (PEN) con vigencia sujeta a stock en tienda.', 40, footerY + 12);
        doc.text('• Documento informativo.', 40, footerY + 24);
      } else {
        doc.text('• Gracias por su compra.', 40, footerY + 12);
      }

      doc.end();
    });
  }
}