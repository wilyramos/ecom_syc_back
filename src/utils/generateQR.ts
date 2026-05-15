import QRCode from "qrcode";
import { ISale } from "../models/Sale";

/**
 * Genera la cadena de datos requerida por SUNAT para el Código QR.
 * Formato: RUC | Tipo Doc | Serie | Número | IGV | Total | Fecha Emisión | Tipo Doc Receptor | Número Doc Receptor | Hash
 */
const generateQRData = (sale: ISale, rucEmpresa: string, hash: string): string => {
  // En Perú, los comprobantes tienen un tipo (01: Factura, 03: Boleta)
  const tipoDocumento = sale.receiptType === "FACTURA" ? "01" : "03";
  const serie = sale.receiptNumber?.split("-")[0] || "";
  const numero = sale.receiptNumber?.split("-")[1] || "";
  const igv = (sale.totalPrice - sale.totalPrice / 1.18).toFixed(2);
  const total = sale.totalPrice.toFixed(2);
  const fechaEmision = new Date(sale.createdAt).toISOString().split("T")[0];

  // Datos del cliente
  const tipoDocCliente = sale.customerSnapshot?.tipoDocumento === "RUC" ? "6" : "1"; // 6: RUC, 1: DNI
  const numeroDocCliente = sale.customerSnapshot?.numeroDocumento || "0"; // '0' si no hay documento (Boleta)

  // Ensambla la cadena
  return `${rucEmpresa}|${tipoDocumento}|${serie}|${numero}|${igv}|${total}|${fechaEmision}|${tipoDocCliente}|${numeroDocCliente}|${hash}|`;
};

/**
 * Genera un código QR como una cadena de datos base64.
 * @param sale Datos de la venta.
 * @param rucEmpresa RUC de tu empresa.
 * @param hash El código hash (firma digital) del comprobante.
 * @returns Promesa que resuelve con la URL del QR en formato base64.
 */
export const generateQRCode = async (
  sale: ISale,
  rucEmpresa: string,
  hash: string
): Promise<string> => {
  try {
    const qrData = generateQRData(sale, rucEmpresa, hash);
    return await QRCode.toDataURL(qrData);
  } catch (err) {
    console.error("Error al generar el Código QR:", err);
    return ""; // Devuelve una cadena vacía en caso de error
  }
};