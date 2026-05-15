/* File: backend/src/modules/cash/cash.service.ts 
    @Author: whramos 
    @Description: Logic for managing cash shifts, movements, and financial summaries.
*/

import { Sale, SaleStatus } from '../../models/Sale';
import { CashShift, CashMovement } from './cash.model';

export class CashService {
  /**
   * Retrieves the currently open shift, if any.
   */
  async getActiveShift() {
    return await CashShift.findOne({ status: 'OPEN' }).populate('openedBy', 'nombre');
  }

  /**
   * Starts a new cash shift.
   */
  async openShift(userId: string, initialBalance: number) {
    const existing = await this.getActiveShift();
    if (existing) throw new Error("A cash shift is already open.");

    return await CashShift.create({
      openedBy: userId,
      initialBalance,
      expectedBalance: initialBalance
    });
  }

  /**
   * Registers manual cash entries or withdrawals (Incomes/Expenses).
   */
  async addMovement(shiftId: string, type: 'INCOME' | 'EXPENSE', amount: number, reason: string) {
    const shift = await CashShift.findById(shiftId);
    if (!shift || shift.status === 'CLOSED') throw new Error("Shift not found or already closed.");

    await CashMovement.create({ shiftId, type, amount, reason });

    if (type === 'INCOME') shift.totalIncomes += amount;
    else shift.totalExpenses += amount;

    // Recalculate Expected Balance: Start + Sales + Incomes - Expenses
    shift.expectedBalance = shift.initialBalance + shift.totalSalesCash + shift.totalIncomes - shift.totalExpenses;

    return await shift.save();
  }

  /**
   * Internal hook to update cash balance when a sale is completed.
   */
  async updateCashFromSale(amount: number) {
    const shift = await this.getActiveShift();
    if (!shift) return;

    shift.totalSalesCash += amount;
    shift.expectedBalance += amount;
    await shift.save();
  }

  /**
   * Finalizes the shift and registers the audit difference.
   */
  async closeShift(shiftId: string, realBalance: number, userId: string, notes?: string) {
    const shift = await CashShift.findById(shiftId);
    if (!shift || shift.status === 'CLOSED') throw new Error("Shift is already closed.");

    shift.realBalance = realBalance;
    shift.difference = realBalance - shift.expectedBalance;
    shift.status = 'CLOSED';
    shift.closedBy = userId as any;
    shift.closingDate = new Date();
    shift.notes = notes;

    return await shift.save();
  }

  /**
   * COMPREHENSIVE SUMMARY FOR THE ARQUEO MODAL
   * Fixed: Matches frontend Zod schema expectations.
   */
  async getClosingSummary(shiftId: string) {
    // 1. Get Shift details with operator name
    const shift = await CashShift.findById(shiftId).populate('openedBy', 'nombre');
    if (!shift) throw new Error("Turno de caja no encontrado.");

    // 2. Retrieve real sales (Exclude proformas/Quotes)
    const sales = await Sale.find({
      cashShiftId: shiftId,
      status: { $ne: SaleStatus.QUOTE }
    });

    // 3. Calculate financial totals
    const calculatedTotal = sales.reduce((acc, sale) => acc + sale.totalPrice, 0);

    // 4. Detailed payment method breakdown (Optional, but useful for Passthrough)
    const breakdown = {
      CASH: 0,
      CARD: 0,
      YAPE: 0,
      PLIN: 0,
      TRANSFER: 0
    };

    sales.forEach(sale => {
      const method = sale.paymentMethod as keyof typeof breakdown;
      if (breakdown[method] !== undefined) {
        breakdown[method] += sale.totalPrice;
      }
    });

    // 5. Return precise structure for 'cashSummarySchema'
    return {
      shift,             // Required by Zod
      calculatedTotal,   // Required by Zod
      salesCount: sales.length, // Required by Zod
      breakdown          // Extra info (allowed by .passthrough())
    };
  }

  /**
 * Retrieves all manual movements for a specific shift.
 */
async getMovements(shiftId: string) {
  return await CashMovement.find({ shiftId }).sort({ createdAt: -1 });
}
}