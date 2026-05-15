import PDFDocument from "pdfkit";

type BuildContentFn<T> = (doc: PDFKit.PDFDocument, data: T) => void;

export class PdfService {
    /**
     * @param buildContent Función que inyecta el diseño
     * @param data Datos dinámicos
     * @param options Opciones de PDFKit (tamaño de papel, márgenes)
     */
    static async generateBuffer<T>(
        buildContent: BuildContentFn<T>, 
        data: T,
        options: PDFKit.PDFDocumentOptions = { margin: 50, size: "A4" } // A4 por defecto
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                // Ahora inyectamos las opciones dinámicas (Ej: size: [288, 432] para etiquetas 4x6)
                const doc = new PDFDocument(options);
                const chunks: Buffer[] = [];

                doc.on("data", (chunk) => chunks.push(chunk));
                doc.on("end", () => resolve(Buffer.concat(chunks)));
                doc.on("error", (err) => reject(err));

                buildContent(doc, data);
                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }
}