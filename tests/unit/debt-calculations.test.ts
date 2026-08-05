import { describe, test, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  calculateDebtTotals,
  calculateDebtProgress,
  findNextDueDate,
  validateDebtPayment,
  deriveInstallmentStatus,
  deriveDebtStatus,
  shouldMarkAsPaidOff,
  recalculateInstallmentStatus,
} from '@/lib/financial/debt-calculations';

describe('calculateDebtTotals', () => {
  test('should calculate total paid and balance correctly', () => {
    const originalPrincipal = new Prisma.Decimal('10000');
    const payments = [
      {
        id: '1',
        debtId: 'debt1',
        principalAmount: new Prisma.Decimal('2000'),
        interestAmount: new Prisma.Decimal('100'),
        feeAmount: new Prisma.Decimal('50'),
        penaltyAmount: new Prisma.Decimal('0'),
        paidAt: new Date(),
        paymentMethod: 'TRANSFER' as const,
        installmentId: null,
        personalCardId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        debtId: 'debt1',
        principalAmount: new Prisma.Decimal('3000'),
        interestAmount: new Prisma.Decimal('150'),
        feeAmount: new Prisma.Decimal('0'),
        penaltyAmount: new Prisma.Decimal('0'),
        paidAt: new Date(),
        paymentMethod: 'TRANSFER' as const,
        installmentId: null,
        personalCardId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = calculateDebtTotals(originalPrincipal, payments);

    expect(result.principalPaid.toNumber()).toBe(5000);
    expect(result.interestPaid.toNumber()).toBe(250);
    expect(result.currentBalance.toNumber()).toBe(5000);
    expect(result.totalPaid.toNumber()).toBe(5300);
    expect(result.isFullyPaid).toBe(false);
  });

  test('should handle zero payments', () => {
    const originalPrincipal = new Prisma.Decimal('10000');
    const result = calculateDebtTotals(originalPrincipal, []);

    expect(result.principalPaid.toNumber()).toBe(0);
    expect(result.currentBalance.toNumber()).toBe(10000);
    expect(result.isFullyPaid).toBe(false);
  });

  test('should mark as paid off when balance ≤ 0', () => {
    const originalPrincipal = new Prisma.Decimal('5000');
    const payments = [
      {
        id: '1',
        debtId: 'debt1',
        principalAmount: new Prisma.Decimal('5500'),
        interestAmount: new Prisma.Decimal('0'),
        feeAmount: new Prisma.Decimal('0'),
        penaltyAmount: new Prisma.Decimal('0'),
        paidAt: new Date(),
        paymentMethod: 'TRANSFER' as const,
        installmentId: null,
        personalCardId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = calculateDebtTotals(originalPrincipal, payments);

    expect(result.isFullyPaid).toBe(true);
    expect(result.currentBalance.toNumber()).toBeLessThanOrEqual(0);
  });

  test('should not allow negative balance in principalRemaining', () => {
    const originalPrincipal = new Prisma.Decimal('5000');
    const payments = [
      {
        id: '1',
        debtId: 'debt1',
        principalAmount: new Prisma.Decimal('10000'),
        interestAmount: new Prisma.Decimal('0'),
        feeAmount: new Prisma.Decimal('0'),
        penaltyAmount: new Prisma.Decimal('0'),
        paidAt: new Date(),
        paymentMethod: 'TRANSFER' as const,
        installmentId: null,
        personalCardId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = calculateDebtTotals(originalPrincipal, payments);

    expect(result.currentBalance.toNumber()).toBeLessThanOrEqual(0);
  });
});

describe('calculateDebtProgress', () => {
  test('should calculate progress as percentage', () => {
    const result = calculateDebtProgress(new Prisma.Decimal('10000'), new Prisma.Decimal('7500'));

    expect(result.progress).toBe(75);
    expect(result.isPaidOff).toBe(false);
  });

  test('should return 100% when fully paid', () => {
    const result = calculateDebtProgress(new Prisma.Decimal('10000'), new Prisma.Decimal('10000'));

    expect(result.progress).toBe(100);
    expect(result.isPaidOff).toBe(true);
  });

  test('should return 0% when nothing paid', () => {
    const result = calculateDebtProgress(new Prisma.Decimal('10000'), new Prisma.Decimal('0'));

    expect(result.progress).toBe(0);
    expect(result.isPaidOff).toBe(false);
  });

  test('should clamp progress to 100% when overpaid', () => {
    const result = calculateDebtProgress(new Prisma.Decimal('10000'), new Prisma.Decimal('15000'));

    expect(result.progress).toBe(100);
    expect(result.isPaidOff).toBe(true);
  });

  test('should handle numeric inputs', () => {
    const result = calculateDebtProgress(10000, 5000);

    expect(result.progress).toBe(50);
    expect(result.isPaidOff).toBe(false);
  });
});

describe('findNextDueDate', () => {
  test('should return earliest pending due date', () => {
    const installments = [
      {
        id: '1',
        debtId: 'debt1',
        dueDate: new Date('2026-08-15'),
        status: 'PAID' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('1000'),
        principalPaid: new Prisma.Decimal('1000'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        debtId: 'debt1',
        dueDate: new Date('2026-08-20'),
        status: 'PENDING' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('0'),
        principalPaid: new Prisma.Decimal('0'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '3',
        debtId: 'debt1',
        dueDate: new Date('2026-08-25'),
        status: 'PENDING' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('0'),
        principalPaid: new Prisma.Decimal('0'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = findNextDueDate(installments);

    expect(result?.toISOString().split('T')[0]).toBe('2026-08-20');
  });

  test('should return null if all paid', () => {
    const installments = [
      {
        id: '1',
        debtId: 'debt1',
        dueDate: new Date('2026-08-15'),
        status: 'PAID' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('1000'),
        principalPaid: new Prisma.Decimal('1000'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        debtId: 'debt1',
        dueDate: new Date('2026-08-20'),
        status: 'PAID' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('1000'),
        principalPaid: new Prisma.Decimal('1000'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = findNextDueDate(installments);

    expect(result).toBeNull();
  });

  test('should return null for empty list', () => {
    const result = findNextDueDate([]);

    expect(result).toBeNull();
  });

  test('should skip cancelled installments', () => {
    const installments = [
      {
        id: '1',
        debtId: 'debt1',
        dueDate: new Date('2026-08-15'),
        status: 'CANCELLED' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('0'),
        principalPaid: new Prisma.Decimal('0'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        debtId: 'debt1',
        dueDate: new Date('2026-08-20'),
        status: 'PENDING' as const,
        expectedAmount: new Prisma.Decimal('1000'),
        totalPaid: new Prisma.Decimal('0'),
        principalPaid: new Prisma.Decimal('0'),
        interestPaid: new Prisma.Decimal('0'),
        feesPaid: new Prisma.Decimal('0'),
        penaltiesPaid: new Prisma.Decimal('0'),
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const result = findNextDueDate(installments);

    expect(result?.toISOString().split('T')[0]).toBe('2026-08-20');
  });
});

describe('validateDebtPayment', () => {
  test('should accept valid desglose that sums to payment amount', () => {
    const result = validateDebtPayment(400, 60, 30, 10, new Prisma.Decimal('5000'));

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('should reject principal > current balance', () => {
    const result = validateDebtPayment(5500, 0, 0, 0, new Prisma.Decimal('5000'));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('no puede superar');
  });

  test('should reject negative amounts', () => {
    const result = validateDebtPayment(-100, 0, 0, 0, new Prisma.Decimal('5000'));

    expect(result.valid).toBe(false);
  });

  test('should allow zero non-principal components', () => {
    const result = validateDebtPayment(500, 0, 0, 0, new Prisma.Decimal('5000'));

    expect(result.valid).toBe(true);
  });

  test('should reject zero total amount', () => {
    const result = validateDebtPayment(0, 0, 0, 0, new Prisma.Decimal('5000'));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('mayor que cero');
  });
});

describe('shouldMarkAsPaidOff', () => {
  test('should return true when balance is 0', () => {
    expect(shouldMarkAsPaidOff(new Prisma.Decimal('0'))).toBe(true);
  });

  test('should return true when balance is negative', () => {
    expect(shouldMarkAsPaidOff(new Prisma.Decimal('-100'))).toBe(true);
  });

  test('should return false when balance is positive', () => {
    expect(shouldMarkAsPaidOff(new Prisma.Decimal('100'))).toBe(false);
  });

  test('should handle numeric input', () => {
    expect(shouldMarkAsPaidOff(0)).toBe(true);
    expect(shouldMarkAsPaidOff(100)).toBe(false);
  });
});
