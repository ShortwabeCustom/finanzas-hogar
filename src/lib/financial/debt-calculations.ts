import {
  DebtAccount,
  DebtInstallment,
  DebtPayment,
  DebtStatus,
  DebtInstallmentStatus,
  Prisma,
} from "@prisma/client";

export interface DebtTotals {
  principalPaid: Prisma.Decimal;
  interestPaid: Prisma.Decimal;
  feesPaid: Prisma.Decimal;
  penaltiesPaid: Prisma.Decimal;
  totalPaid: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
  isFullyPaid: boolean;
}

export interface DebtProgressInfo {
  progress: number;
  isPaidOff: boolean;
  principalRemaining: Prisma.Decimal;
}

export function calculateDebtTotals(
  originalPrincipal: Prisma.Decimal,
  payments: DebtPayment[]
): DebtTotals {
  const principalPaid = payments.reduce(
    (sum, p) => sum.plus(new Prisma.Decimal(p.principalAmount)),
    new Prisma.Decimal(0)
  );
  const interestPaid = payments.reduce(
    (sum, p) => sum.plus(new Prisma.Decimal(p.interestAmount)),
    new Prisma.Decimal(0)
  );
  const feesPaid = payments.reduce(
    (sum, p) => sum.plus(new Prisma.Decimal(p.feeAmount)),
    new Prisma.Decimal(0)
  );
  const penaltiesPaid = payments.reduce(
    (sum, p) => sum.plus(new Prisma.Decimal(p.penaltyAmount)),
    new Prisma.Decimal(0)
  );

  const totalPaid = principalPaid.plus(interestPaid).plus(feesPaid).plus(penaltiesPaid);
  const currentBalance = new Prisma.Decimal(originalPrincipal).minus(principalPaid);

  return {
    principalPaid,
    interestPaid,
    feesPaid,
    penaltiesPaid,
    totalPaid,
    currentBalance,
    isFullyPaid: currentBalance.lessThanOrEqualTo(0),
  };
}

export function calculateDebtProgress(
  originalPrincipal: Prisma.Decimal | number,
  principalPaid: Prisma.Decimal | number
): DebtProgressInfo {
  const principal = new Prisma.Decimal(originalPrincipal);
  const paid = new Prisma.Decimal(principalPaid);
  const remaining = principal.minus(paid);

  const progressPercent = paid.dividedBy(principal).times(100).toNumber();

  return {
    progress: Math.min(100, Math.max(0, progressPercent)),
    isPaidOff: remaining.lessThanOrEqualTo(0),
    principalRemaining: remaining.lessThan(0) ? new Prisma.Decimal(0) : remaining,
  };
}

export function deriveInstallmentStatus(
  installment: DebtInstallment,
  today: Date = new Date()
): DebtInstallmentStatus {
  if (installment.status === "CANCELLED") return "CANCELLED";

  const dueDate = new Date(installment.dueDate);
  const expected = new Prisma.Decimal(installment.expectedAmount);
  const paid = new Prisma.Decimal(installment.totalPaid);

  if (paid.greaterThanOrEqualTo(expected)) return "PAID";

  if (paid.greaterThan(0)) return "PARTIALLY_PAID";

  if (dueDate < today) return "OVERDUE";

  return "PENDING";
}

export function deriveDebtStatus(
  debt: { originalPrincipal: Prisma.Decimal | number; status: DebtStatus },
  currentBalance: Prisma.Decimal | number,
  nextDueDate: Date | null
): DebtStatus {
  if (debt.status === "CANCELLED" || debt.status === "DEFAULTED" || debt.status === "PAUSED") {
    return debt.status;
  }

  if (new Prisma.Decimal(currentBalance).lessThanOrEqualTo(0)) {
    return "PAID_OFF";
  }

  return "ACTIVE";
}

export function findNextDueDate(
  installments: DebtInstallment[],
  today: Date = new Date()
): Date | null {
  const unpaid = installments.filter(
    (inst) => inst.status !== "PAID" && inst.status !== "CANCELLED"
  );

  if (unpaid.length === 0) return null;

  const sorted = unpaid.sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  );

  return sorted[0] ? new Date(sorted[0].dueDate) : null;
}

export function validateDebtPayment(
  principal: Prisma.Decimal | number,
  interest: Prisma.Decimal | number,
  fees: Prisma.Decimal | number,
  penalties: Prisma.Decimal | number,
  currentBalance: Prisma.Decimal | number
): { valid: boolean; error?: string } {
  const principalDecimal = new Prisma.Decimal(String(principal));
  const totalAmount = new Prisma.Decimal(String(principal))
    .plus(new Prisma.Decimal(String(interest)))
    .plus(new Prisma.Decimal(String(fees)))
    .plus(new Prisma.Decimal(String(penalties)));

  if (totalAmount.lessThanOrEqualTo(0)) {
    return { valid: false, error: "El monto total debe ser mayor que cero" };
  }

  if (principalDecimal.greaterThan(new Prisma.Decimal(String(currentBalance)))) {
    return { valid: false, error: "El capital aplicado no puede superar el saldo pendiente" };
  }

  if (principalDecimal.lessThan(0)) {
    return { valid: false, error: "El capital no puede ser negativo" };
  }

  return { valid: true };
}

export function shouldMarkAsPaidOff(currentBalance: Prisma.Decimal | number): boolean {
  return new Prisma.Decimal(String(currentBalance)).lessThanOrEqualTo(0);
}

export function recalculateInstallmentStatus(
  installment: DebtInstallment,
  payments: DebtPayment[]
): DebtInstallmentStatus {
  const installmentPayments = payments.filter((p) => p.installmentId === installment.id);
  const totalPaid = installmentPayments.reduce(
    (sum, p) => sum.plus(new Prisma.Decimal(p.principalAmount)),
    new Prisma.Decimal(0)
  );

  const expected = new Prisma.Decimal(installment.expectedAmount);

  if (totalPaid.greaterThanOrEqualTo(expected)) return "PAID";
  if (totalPaid.greaterThan(0)) return "PARTIALLY_PAID";

  const today = new Date();
  const dueDate = new Date(installment.dueDate);
  if (dueDate < today) return "OVERDUE";

  return "PENDING";
}
