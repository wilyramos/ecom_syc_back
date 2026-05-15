import PDFDocument from 'pdfkit';
import { ISale } from '../../models/Sale';

export class TicketService {
  async generateTicketBuffer(sale: ISale): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // Ancho de 80mm para tiquetera térmica (aprox 226pt)
      const doc = new PDFDocument({
        size: [226, 600], // Altura inicial, pdfkit la expande si es necesario
        margins: { top: 10, left: 15, bottom: 10, right: 15 }
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // --- CONTENIDO DEL TICKET ---
      doc.font('Helvetica-Bold').fontSize(12).text('POS SYSTEM v2', { align: 'center' });
      doc.font('Helvetica').fontSize(8).text('RUC: 20600000000', { align: 'center' });
      doc.text('AV. PRINCIPAL 123 - LIMA', { align: 'center' });
      doc.moveDown();

      doc.fontSize(9).font('Helvetica-Bold').text(`${sale.receiptType}: ${sale.receiptNumber}`);
      doc.fontSize(7).font('Helvetica').text(`Fecha: ${new Date(sale.createdAt).toLocaleString()}`);
      doc.text(`Cajero: ${(sale.employee as any)?.nombre || 'Admin'}`);
      doc.moveDown(0.5);

      doc.text('-'.repeat(48));
      doc.font('Helvetica-Bold').text('CANT  PRODUCTO             TOTAL');
      doc.text('-'.repeat(48));

      doc.font('Helvetica').fontSize(7);
      sale.items.forEach((item: any) => {
        const subtotal = (item.price * item.quantity).toFixed(2);
        const name = item.product.nombre.substring(0, 20);
        
        // Fila principal
        doc.text(`${item.quantity.toString().padEnd(5)} ${name.padEnd(20)} ${subtotal.padStart(8)}`);
        
        // Detalles de variante
        if (item.variantId && item.product.variants) {
          const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
          if (variant) {
            doc.fontSize(6).text(`      Mod: ${variant.nombre}`, { oblique: true }).fontSize(7);
          }
        }
      });

      doc.moveDown(0.5);
      doc.text('-'.repeat(48));
      doc.fontSize(10).font('Helvetica-Bold').text(`TOTAL: $${sale.totalPrice.toFixed(2)}`, { align: 'right' });
      
      doc.moveDown();
      doc.fontSize(7).font('Helvetica').text('¡GRACIAS POR SU COMPRA!', { align: 'center' });

      doc.end();
    });
  }
}