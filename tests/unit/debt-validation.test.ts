import { describe, test, expect } from 'vitest';
import {
  debtFormSchema,
  debtPaymentSchema,
  linkTransactionSchema,
  generateInstallmentsSchema,
} from '@/lib/validations/debt';

describe('debtFormSchema', () => {
  test('should accept valid debt form', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test Card',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject missing name', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should reject currentPrincipal > originalPrincipal', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test',
      originalPrincipal: 5000,
      currentPrincipal: 6000,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept RECEIVABLE direction', () => {
    const data = {
      direction: 'RECEIVABLE',
      type: 'LOAN_GRANTED',
      name: 'Loan to friend',
      originalPrincipal: 2000,
      currentPrincipal: 1500,
      startDate: '2026-07-01',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should accept optional counterparty name', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'PERSONAL_LOAN',
      name: 'Bank Loan',
      counterpartyName: 'ABC Bank',
      originalPrincipal: 10000,
      currentPrincipal: 8000,
      startDate: '2026-01-01',
      scheduleMode: 'INSTALLMENTS',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject negative originalPrincipal', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test',
      originalPrincipal: -5000,
      currentPrincipal: 0,
      startDate: '2026-08-01',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept optional interest rate', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'AUTO_LOAN',
      name: 'Car Loan',
      originalPrincipal: 20000,
      currentPrincipal: 18000,
      annualInterestRate: 5.5,
      startDate: '2026-03-01',
      scheduleMode: 'INSTALLMENTS',
      numberOfInstallments: 60,
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject invalid date format', () => {
    const data = {
      direction: 'PAYABLE',
      type: 'CREDIT_CARD',
      name: 'Test',
      originalPrincipal: 5000,
      currentPrincipal: 5000,
      startDate: 'invalid-date',
      scheduleMode: 'FREE',
    };

    const result = debtFormSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('debtPaymentSchema', () => {
  test('should accept valid payment', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 400,
      interestAmount: 60,
      feeAmount: 30,
      penaltyAmount: 10,
      paymentMethod: 'TRANSFER',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject negative principal', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: -100,
      interestAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      paymentMethod: 'TRANSFER',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept zero interest/fees', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 500,
      interestAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      paymentMethod: 'TRANSFER',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should default interest/fees to 0', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 500,
      paymentMethod: 'CASH',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.interestAmount).toBe(0);
      expect(result.data.feeAmount).toBe(0);
      expect(result.data.penaltyAmount).toBe(0);
    }
  });

  test('should reject zero total amount', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 0,
      interestAmount: 0,
      feeAmount: 0,
      penaltyAmount: 0,
      paymentMethod: 'TRANSFER',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept all payment methods', () => {
    const paymentMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'CHECK', 'OTHER'];

    paymentMethods.forEach((method) => {
      const data = {
        paidAt: '2026-08-05',
        principalAmount: 100,
        paymentMethod: method,
      };

      const result = debtPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  test('should reject invalid payment method', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 100,
      paymentMethod: 'INVALID_METHOD',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept optional installmentId', () => {
    const data = {
      paidAt: '2026-08-05',
      principalAmount: 500,
      installmentId: 'inst-123',
      paymentMethod: 'TRANSFER',
    };

    const result = debtPaymentSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('linkTransactionSchema', () => {
  test('should accept valid link transaction', () => {
    const data = {
      debtId: 'debt-123',
      principalAmount: 500,
      paymentMethod: 'TRANSFER',
    };

    const result = linkTransactionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject missing debtId', () => {
    const data = {
      principalAmount: 500,
    };

    const result = linkTransactionSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept optional installmentId', () => {
    const data = {
      debtId: 'debt-123',
      installmentId: 'inst-456',
      principalAmount: 300,
    };

    const result = linkTransactionSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('generateInstallmentsSchema', () => {
  test('should accept valid installment generation', () => {
    const data = {
      numberOfInstallments: 12,
      firstPaymentDate: '2026-09-01',
      paymentFrequency: 'MONTHLY',
    };

    const result = generateInstallmentsSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  test('should reject zero installments', () => {
    const data = {
      numberOfInstallments: 0,
      firstPaymentDate: '2026-09-01',
      paymentFrequency: 'MONTHLY',
    };

    const result = generateInstallmentsSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should reject more than 360 installments', () => {
    const data = {
      numberOfInstallments: 361,
      firstPaymentDate: '2026-09-01',
      paymentFrequency: 'MONTHLY',
    };

    const result = generateInstallmentsSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('should accept all payment frequencies', () => {
    const frequencies = ['ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'];

    frequencies.forEach((freq) => {
      const data = {
        numberOfInstallments: 12,
        firstPaymentDate: '2026-09-01',
        paymentFrequency: freq,
      };

      const result = generateInstallmentsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  test('should reject invalid date format', () => {
    const data = {
      numberOfInstallments: 12,
      firstPaymentDate: 'invalid-date',
      paymentFrequency: 'MONTHLY',
    };

    const result = generateInstallmentsSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});
