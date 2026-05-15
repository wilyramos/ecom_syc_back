import PDFDocument from 'pdfkit';

const COMPANY = {
    nombre: "GOPHONE",
    ruc: "1072516715",
    direccion: "Jr. Bernardo O'Higgins 120",
    city: "Cañete, Lima - Perú",
    telefono: "972416683",
};

export const generateSaleTicket = (sale: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const isQuote = sale.status === 'QUOTE';
        
        // Tamaño típico de ticket de 80mm (226pt)
        const doc = new PDFDocument({ 
            size: [226, 800], 
            margin: 0 
        });
        
        const buffers: Buffer[] = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const contentWidth = 200; 
        const startX = 13;
        let currentY = 15;

        const drawLine = (y: number) => {
            doc.moveTo(startX, y).lineTo(startX + contentWidth, y).lineWidth(0.5).strokeColor('#000000').stroke();
        };

        const formatPrice = (amount: number) => `S/ ${amount.toFixed(2)}`;

        // --- ENCABEZADO ---
        doc.font('Helvetica-Bold').fontSize(14).text(COMPANY.nombre, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 16;
        doc.font('Helvetica').fontSize(8)
           .text(`RUC: ${COMPANY.ruc}`, { align: 'center', width: contentWidth })
           .text(COMPANY.direccion, { align: 'center', width: contentWidth })
           .text(COMPANY.city, { align: 'center', width: contentWidth });
        currentY += 35;

        // --- TÍTULO ---
        const title = isQuote ? 'PROFORMA DE VENTA' : 'NOTA DE VENTA';
        doc.rect(startX, currentY - 2, contentWidth, 15).fill('#eeeeee');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10).text(title, startX, currentY, { align: 'center', width: contentWidth });
        currentY += 20;
        
        // --- INFO TRANSACCIÓN ---
        doc.font('Helvetica-Bold').fontSize(8);
        const labelCol = startX;
        const valueCol = startX + 80;

        const addInfoRow = (label: string, value: string, color = '#000000') => {
            doc.font('Helvetica-Bold').fillColor('#000000').text(label, labelCol, currentY);
            doc.font('Helvetica').fillColor(color).text(value, valueCol, currentY);
            currentY += 11;
        };

        if (isQuote) {
            addInfoRow('ID PROFORMA:', sale._id.toString().slice(-8).toUpperCase());
        } else {
            addInfoRow('N° COMPROBANTE:', sale.receiptNumber || '---');
        }

        addInfoRow('FECHA EMISIÓN:', new Date(sale.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));

        if (isQuote && sale.quoteExpirationDate) {
            addInfoRow('VÁLIDO HASTA:', new Date(sale.quoteExpirationDate).toLocaleDateString('es-PE'), '#d97706');
        }

        if (sale.employee) {
            // addInfoRow('ATENDIDO POR:', sale.employee.nombre.toUpperCase());
        }

        currentY += 5;

        // --- TABLA DE ITEMS ---
        drawLine(currentY);
        currentY += 5;
        doc.font('Helvetica-Bold').fontSize(7).text('CANT.', startX, currentY);
        doc.text('DESCRIPCIÓN', startX + 30, currentY);
        doc.text('TOTAL', startX, currentY, { align: 'right', width: contentWidth });
        currentY += 10;
        drawLine(currentY);
        currentY += 7;

        sale.items.forEach((item: any) => {
            const name = item.product?.nombre.toUpperCase() || 'PRODUCTO';
            const totalItem = item.price * item.quantity;
            
            doc.font('Helvetica-Bold').fontSize(8).text(`${item.quantity}`, startX, currentY);
            
            const nameX = startX + 30;
            const nameWidth = 110;
            const nameHeight = doc.heightOfString(name, { width: nameWidth });
            
            doc.text(name, nameX, currentY, { width: nameWidth });
            doc.text(formatPrice(totalItem), startX, currentY, { align: 'right', width: contentWidth });
            
            currentY += nameHeight + 2;

            // Variantes
            if (item.variantId && item.product?.variants) {
                const variant = item.product.variants.find((v: any) => v._id.toString() === item.variantId.toString());
                if (variant) {
                    doc.font('Helvetica-Oblique').fontSize(7).fillColor('#4b5563').text(`VAR: ${variant.nombre.toUpperCase()}`, nameX, currentY);
                    currentY += 9;
                }
            }
            doc.fillColor('#000000');
            currentY += 3;
        });

        currentY += 5;
        drawLine(currentY);
        currentY += 8;

        // --- RESUMEN DE TOTALES ---
        const total = sale.totalPrice;
        const subtotal = total / 1.18;
        const igv = total - subtotal;

        const addTotalRow = (label: string, value: string, isMain = false) => {
            doc.font(isMain ? 'Helvetica-Bold' : 'Helvetica').fontSize(isMain ? 10 : 8);
            doc.text(label, startX + 60, currentY, { align: 'right', width: 70 });
            doc.text(value, startX + 130, currentY, { align: 'right', width: 70 });
            currentY += isMain ? 15 : 11;
        };

        addTotalRow('Subtotal:', formatPrice(subtotal));
        addTotalRow('IGV (18%):', formatPrice(igv));
        currentY += 2;
        addTotalRow('TOTAL A PAGAR:', formatPrice(total), true);

        currentY += 15;

        // --- PIE DE PÁGINA ---
        doc.font('Helvetica-Bold').fontSize(8).text(
            isQuote ? 'ESTE DOCUMENTO ES UNA PROFORMA' : '¡GRACIAS POR SU COMPRA!', 
            startX, currentY, { align: 'center', width: contentWidth }
        );
        currentY += 12;
        
        doc.font('Helvetica').fontSize(7).fillColor('#4b5563');
        if (isQuote) {
            doc.text('* Precios sujetos a cambios sin previo aviso.', { align: 'center', width: contentWidth });
            doc.text('* Stock no garantizado hasta la compra.', { align: 'center', width: contentWidth });
        } else {
            doc.text('Este ticket no es válido para fines tributarios.', { align: 'center', width: contentWidth });
            doc.text('Conserve su ticket para cambios o garantías.', { align: 'center', width: contentWidth });
        }
        
        currentY += 15;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('www.gophone.pe', { align: 'center', width: contentWidth });

        doc.end();
    });
};