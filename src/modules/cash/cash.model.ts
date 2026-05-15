import mongoose, { Schema, Document } from 'mongoose';

export interface ICashShift extends Document {
    openedBy: mongoose.Types.ObjectId;
    closedBy?: mongoose.Types.ObjectId;
    status: 'OPEN' | 'CLOSED';
    openingDate: Date;
    closingDate?: Date;
    initialBalance: number;
    totalSalesCash: number;
    totalIncomes: number;
    totalExpenses: number;
    expectedBalance: number;
    realBalance?: number;
    difference?: number;
    notes?: string;
}

const CashShiftSchema = new Schema<ICashShift>({
    openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    openingDate: { type: Date, default: Date.now },
    closingDate: { type: Date },
    initialBalance: { type: Number, required: true, default: 0 },
    totalSalesCash: { type: Number, default: 0 },
    totalIncomes: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    expectedBalance: { type: Number, default: 0 },
    realBalance: { type: Number },
    difference: { type: Number },
    notes: { type: String }
});

export const CashMovement = mongoose.model('CashMovement', new Schema({
    shiftId: { type: Schema.Types.ObjectId, ref: 'CashShift', required: true },
    type: { type: String, enum: ['INCOME', 'EXPENSE'], required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}));

export const CashShift = mongoose.model<ICashShift>('CashShift', CashShiftSchema);