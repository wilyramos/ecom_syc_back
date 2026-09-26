/* File: backend/src/modules/sale/pdf.service.ts */
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

export class PdfService {
  private readonly RUC = '10725009858';
  private readonly RAZON_SOCIAL = 'SYC Mobile Perú';
  private readonly DIRECCION = 'Av. Mariscal Benavides 713 - Cañete, Perú';
  private readonly TELEFONO = 'Teléfono: 972 416 683';

  async generateA4Buffer(sale: ISale): Promise<Buffer> {
    const isQuote = sale.isQuote || sale.status === SaleStatus.QUOTE;

    return new Promise((resolve, reject) => {
      // Formato estándar A4 (595.28 x 841.89 pt)
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, left: 40, bottom: 40, right: 40 },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // --- 1. CABECERA INSTITUCIONAL Y RECUADRO RUC ---
      doc.font('Helvetica-Bold').fontSize(16).text(this.RAZON_SOCIAL, 40, 40);
      doc.font('Helvetica').fontSize(9).text(this.DIRECCION, 40, 62);
      doc.text(this.TELEFONO, 40, 75);

      // Recuadro del Comprobante (Lado derecho superior)
      doc.rect(380, 40, 175, 75).lineWidth(1.5).strokeColor('#000000').stroke();
      doc.font('Helvetica-Bold').fontSize(11).text(`R.U.C. ${this.RUC}`, 380, 52, { width: 175, align: 'center' });
      const docName = isQuote ? 'COTIZACIÓN / PROFORMA' : (sale.receiptType || 'BOLETA ELECTRÓNICA');
      doc.fontSize(10).text(docName, 380, 70, { width: 175, align: 'center' });
      doc.fontSize(12).text(`N° ${sale.receiptNumber || '000000'}`, 380, 88, { width: 175, align: 'center' });

      // --- 2. DATOS DEL CLIENTE Y OPERACIÓN ---
      let startY = 135;
      doc.rect(40, startY, 515, 60).lineWidth(0.5).strokeColor('#CCCCCC').stroke();

      doc.font('Helvetica-Bold').fontSize(8.5).text('Cliente:', 50, startY + 10);
      doc.font('Helvetica').text(sale.customerSnapshot?.nombre || 'CLIENTES VARIOS', 110, startY + 10);

      doc.font('Helvetica-Bold').text('Documento:', 50, startY + 25);
      const docId = `${sale.customerSnapshot?.tipoDocumento || 'DOC'}: ${sale.customerSnapshot?.numeroDocumento || '-'}`;
      doc.font('Helvetica').text(docId, 110, startY + 25);

      doc.font('Helvetica-Bold').text('Fecha Emisión:', 340, startY + 10);
      doc.font('Helvetica').text(formatPeruDateTime(sale.createdAt), 420, startY + 10);

      if (isQuote && sale.quoteExpirationDate) {
        doc.font('Helvetica-Bold').text('Fecha Venc.:', 340, startY + 25);
        doc.font('Helvetica').text(formatPeruDate(sale.quoteExpirationDate), 420, startY + 25);
      } else {
        doc.font('Helvetica-Bold').text('Forma de Pago:', 340, startY + 25);
        doc.font('Helvetica').text(sale.paymentMethod || 'CONTADO', 420, startY + 25);
      }

      doc.font('Helvetica-Bold').text('Atendido por:', 50, startY + 40);
      doc.font('Helvetica').text((sale.employee as any)?.nombre || 'Asesor Comercial', 110, startY + 40);

      // --- 3. TABLA DE PRODUCTOS (A4 WIDE) ---
      let tableY = 210;
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

        // Línea divisoria suave por fila
        doc.moveTo(40, tableY + 2).lineTo(555, tableY + 2).lineWidth(0.5).strokeColor('#EEEEEE').stroke();
      });

      // --- 4. CUADRO DE TOTALES ---
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
      doc.text('TOTAL:', 390, totalsY + 7);
      doc.text(`S/ ${sale.totalPrice.toFixed(2)}`, 470, totalsY + 7, { width: 80, align: 'right' });

      // --- 5. NOTAS Y CONDICIONES LEGALES ---
      doc.fillColor('#000000');
      let footerY = totalsY + 45;
      doc.font('Helvetica-Bold').fontSize(8).text('OBSERVACIONES / CONDICIONES:', 40, footerY);
      doc.font('Helvetica').fontSize(7.5);

      if (isQuote) {
        doc.text('• Precios expresados en Soles (PEN) con vigencia sujeta a stock en tienda.', 40, footerY + 12);
        doc.text('• Documento informativo que no constituye comprobante de pago electrónico válido ante SUNAT.', 40, footerY + 24);
      } else {
        doc.text('• Gracias por su compra.', 40, footerY + 12);
        doc.text('• ', 40, footerY + 24);
      }

      doc.end();
    });
  }
}