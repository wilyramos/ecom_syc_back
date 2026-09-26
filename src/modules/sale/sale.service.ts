/* File: backend/src/modules/sale/sale.service.ts */
import mongoose, { Types } from 'mongoose';
import { Sale, ISale, SaleStatus, PaymentMethod } from '../../models/Sale';
import Product from '../../models/Product';
import { CashShift } from '../cash/cash.model';
import { UserService } from '../user/user.service';
import User from '../../models/User'; // Registro en memoria para populate

const userService = new UserService();

export class SaleService {
  /**
   * PROCESAR VENTA REAL
   */
  async createSale(saleData: Partial<ISale>) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const activeShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
      if (!activeShift) throw new Error('No hay una caja abierta para registrar la venta.');

      saleData.status = SaleStatus.COMPLETED;
      saleData.isQuote = false;
      saleData.cashShiftId = activeShift._id as Types.ObjectId;

      // 1. Asignar y validar empleado
      const employeeId = saleData.employee || activeShift.openedBy;
      await userService.validateEmployee(employeeId as any);
      saleData.employee = employeeId;

      // 2. Vincular o crear cliente si se envió número de documento
      if (!saleData.customer && saleData.customerSnapshot?.numeroDocumento) {
        const foundCustomer = await userService.findOrCreateCustomer({
          numeroDocumento: saleData.customerSnapshot.numeroDocumento,
          tipoDocumento: saleData.customerSnapshot.tipoDocumento,
          nombre: saleData.customerSnapshot.nombre || 'Cliente',
          telefono: saleData.customerSnapshot.telefono,
          email: saleData.customerSnapshot.email,
        });
        if (foundCustomer) {
          saleData.customer = foundCustomer._id as Types.ObjectId;
        }
      }

      // 3. Descontar Stock
      await this._processStock(saleData.items || [], session);

      // 4. Guardar Venta
      const newSale = new Sale(saleData);
      await newSale.save({ session });

      // 5. Ajustar saldo de caja
      if (newSale.paymentMethod === PaymentMethod.CASH) {
        activeShift.totalSalesCash += newSale.totalPrice;
        activeShift.expectedBalance += newSale.totalPrice;
        await activeShift.save({ session });
      }

      await session.commitTransaction();
      return newSale;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * CREAR PROFORMA / PRESUPUESTO
   */
  async createQuote(saleData: Partial<ISale>) {
    const activeShift = await CashShift.findOne({ status: 'OPEN' });
    if (!activeShift) throw new Error('Se requiere una caja activa para emitir proformas.');

    saleData.status = SaleStatus.QUOTE;
    saleData.isQuote = true;
    saleData.cashShiftId = activeShift._id as Types.ObjectId;

    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 7);
    saleData.quoteExpirationDate = expiration;

    // Vincular cliente si existe
    if (!saleData.customer && saleData.customerSnapshot?.numeroDocumento) {
      const customer = await userService.findOrCreateCustomer({
        numeroDocumento: saleData.customerSnapshot.numeroDocumento,
        tipoDocumento: saleData.customerSnapshot.tipoDocumento,
        nombre: saleData.customerSnapshot.nombre || 'Cliente General',
        telefono: saleData.customerSnapshot.telefono,
        email: saleData.customerSnapshot.email,
      });
      if (customer) {
        saleData.customer = customer._id as Types.ObjectId;
      }
    }

    const quote = new Sale(saleData);
    return await quote.save();
  }

  /**
   * CONVERTIR PROFORMA A VENTA REAL
   */
  async convertQuoteToSale(quoteId: string, employeeId: string, paymentMethod?: PaymentMethod) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const quote = await Sale.findById(quoteId).session(session);
      if (!quote || quote.status !== SaleStatus.QUOTE) {
        throw new Error('La proforma no existe o ya ha sido procesada previamente.');
      }

      const activeShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
      if (!activeShift) throw new Error('Debe abrir caja para convertir esta proforma en venta.');

      await userService.validateEmployee(employeeId);
      await this._processStock(quote.items, session);

      quote.status = SaleStatus.COMPLETED;
      quote.isQuote = false;
      quote.employee = new Types.ObjectId(employeeId) as any;
      if (paymentMethod) quote.paymentMethod = paymentMethod;

      await quote.save({ session });

      if (quote.paymentMethod === PaymentMethod.CASH) {
        activeShift.totalSalesCash += quote.totalPrice;
        activeShift.expectedBalance += quote.totalPrice;
        await activeShift.save({ session });
      }

      await session.commitTransaction();
      return quote;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * OBTENER HISTORIAL DE VENTAS
   * Resuelto: populate('customer') ahora usa el modelo 'User' registrado
   */

  async getSaleHistory(filters: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    cashShiftId?: string;
  }) {
    const { page = 1, limit = 10, search, startDate, endDate, status, cashShiftId } = filters;
    const skip = (page - 1) * limit;

    const query: any = { status: { $ne: SaleStatus.QUOTE } };

    if (search && search.trim() !== '') {
      query.$or = [
        { receiptNumber: { $regex: search.trim(), $options: 'i' } },
        { 'customerSnapshot.nombre': { $regex: search.trim(), $options: 'i' } },
        { 'customerSnapshot.numeroDocumento': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (status && status.trim() !== '') query.status = status;
    if (cashShiftId && Types.ObjectId.isValid(cashShiftId)) {
      query.cashShiftId = new Types.ObjectId(cashShiftId);
    }

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('employee', 'nombre apellidos')
        .populate('customer', 'nombre apellidos numeroDocumento')
        .populate('items.product', 'nombre precio'), // <-- Poblar producto para la tabla
      Sale.countDocuments(query),
    ]);

    return {
      sales,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }
  async getQuotes() {
    return await Sale.find({ status: SaleStatus.QUOTE })
      .sort({ createdAt: -1 })
      .populate('employee', 'nombre apellidos')
      .populate('customer', 'nombre apellidos numeroDocumento');
  }

  async getSaleById(id: string) {
    return await Sale.findById(id)
      .populate('employee', 'nombre apellidos')
      .populate('customer', 'nombre apellidos numeroDocumento email telefono')
      .populate('items.product', 'nombre imagenes');
  }

  async refundSale(saleId: string, reason: string) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const sale = await Sale.findById(saleId).session(session);
      if (!sale) throw new Error('Venta no encontrada.');
      if (sale.status === SaleStatus.REFUNDED || sale.status === SaleStatus.CANCELED) {
        throw new Error('Esta venta ya se encuentra anulada.');
      }

      await this._reverseStock(sale.items, session);

      if (sale.paymentMethod === PaymentMethod.CASH) {
        const shift = await CashShift.findById(sale.cashShiftId).session(session);
        if (shift && shift.status === 'OPEN') {
          shift.totalSalesCash -= sale.totalPrice;
          shift.expectedBalance -= sale.totalPrice;
          await shift.save({ session });
        } else {
          const currentOpenShift = await CashShift.findOne({ status: 'OPEN' }).session(session);
          if (currentOpenShift) {
            currentOpenShift.expectedBalance -= sale.totalPrice;
            await currentOpenShift.save({ session });
          }
        }
      }

      sale.status = SaleStatus.REFUNDED;
      sale.statusHistory.push({ status: SaleStatus.REFUNDED, changedAt: new Date() });
      await sale.save({ session });

      await session.commitTransaction();
      return sale;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async _processStock(items: any[], session: mongoose.ClientSession) {
    for (const item of items) {
      if (item.variantId) {
        const product = await Product.findOneAndUpdate(
          {
            _id: item.product,
            'variants._id': item.variantId,
            'variants.stock': { $gte: item.quantity },
          },
          { $inc: { 'variants.$.stock': -item.quantity } },
          { session, new: true }
        );
        if (!product) throw new Error(`Stock insuficiente para la variante de: ${item.product}`);
      } else {
        const product = await Product.findOneAndUpdate(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { session, new: true }
        );
        if (!product) throw new Error(`Stock insuficiente para el producto: ${item.product}`);
      }
    }
  }

  private async _reverseStock(items: any[], session: mongoose.ClientSession) {
    for (const item of items) {
      if (item.variantId) {
        await Product.findOneAndUpdate(
          { _id: item.product, 'variants._id': item.variantId },
          { $inc: { 'variants.$.stock': item.quantity } },
          { session }
        );
      } else {
        await Product.findOneAndUpdate(
          { _id: item.product },
          { $inc: { stock: item.quantity } },
          { session }
        );
      }
    }
  }
}