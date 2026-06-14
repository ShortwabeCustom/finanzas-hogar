import { prisma } from "@/lib/prisma";
import type { BankAccount, BankStatement } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FinancialStatus = "critical" | "tight" | "stable" | "healthy" | "unknown";

export interface FinancialScore {
  score: number;
  label: string;
  colorKey: "green" | "blue" | "yellow" | "orange" | "red" | "gray";
  confidence: "full" | "partial";
  trend: "up" | "down" | "stable" | "unknown";
  trendLabel: string;
  breakdown: {
    cashflow: number;    // max 40
    overdueDebt: number; // max 35
    urgency: number;     // max 25
  };
}

export interface RecoveryPlanSummary {
  monthlyIncomeAvg: number | null;
  monthlyExpenseAvg: number | null;
  fixedExpensesAvg: number | null;
  variableExpensesAvg: number | null;
  pendingTotal: number;
  overdueTotal: number;
  dueIn7DaysTotal: number;
  dueIn15DaysTotal: number;
  freeCashflow: number | null;
  availableForDebt: number | null;
  financialStatus: FinancialStatus;
}

export interface PaymentPlanItem {
  priority: number;
  sourceModel: "PersonalPayment" | "BankStatement";
  id: string;
  name: string;
  amount: number;
  dueDate: string | null;
  status: string;
  category: string | null;
  paymentMethod: string | null;
  recommendedAction: string;
  reason: string;
}

export interface CutSuggestion {
  category: string;
  monthlyAmount: number;
  suggestedReduction: number;
  reason: string;
}

export interface RecoveryInsight {
  type: "risk" | "warning" | "opportunity" | "info";
  title: string;
  message: string;
  suggestedAction: string;
}

export interface DataQuality {
  hasIncomeData: boolean;
  hasExpenseData: boolean;
  hasPendingPayments: boolean;
  hasOverduePayments: boolean;
  missingFields: string[];
}

export interface MonthProjection {
  month: string;
  remainingDebt: number;
  cumulativePaid: number;
}

export interface ForecastData {
  projections: MonthProjection[];
  monthsToClear: number;
  totalDebt: number;
  monthlyPaymentCapacity: number;
}

export interface SnapshotPoint {
  date: string;           // "YYYY-MM"
  score: number | null;
  scoreLabel: string | null;
  financialStatus: string;
  overdueTotal: number;
  pendingTotal: number;
  freeCashflow: number | null;
}

export interface RecoveryPlan {
  summary: RecoveryPlanSummary;
  paymentPlan: PaymentPlanItem[];
  cutSuggestions: CutSuggestion[];
  insights: RecoveryInsight[];
  dataQuality: DataQuality;
  financialScore: FinancialScore | null;
  forecast: ForecastData | null;
  snapshots: SnapshotPoint[];
  months: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function isIncome(
  financialClass: string | null | undefined,
  type: string | null | undefined,
  categoryName: string
): boolean {
  // Prefer explicit classification when available
  if (financialClass === "INCOME") return true;
  if (financialClass === "EXPENSE" || financialClass === "TRANSFER" || financialClass === "SAVING") return false;
  if (type === "INCOME") return true;
  if (type === "EXPENSE" || type === "TRANSFER") return false;

  // Fallback: infer by category name
  const n = normalizeText(categoryName);
  return (
    n.includes("deposito") ||
    n.includes("abono") ||
    n.includes("transferencias recibidas") ||
    n.includes("ingreso") ||
    n.includes("sueldo") ||
    n.includes("salario") ||
    n.includes("nomina") ||
    n.includes("cobro")
  );
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysFromNow(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function fmtMXN(amount: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

// Reserva mínima de operación mensual
const BASIC_RESERVE_MXN = 500;
const ESTIMATED_CREDIT_CARD_DUE_DAYS = 20;

type CreditAccountWithStatements = BankAccount & {
  statements: BankStatement[];
};

type BankCashflowTransaction = {
  transactionDate: Date;
  chargeAmount: { toString(): string } | null;
  creditAmount: { toString(): string } | null;
  description: string;
  category: string | null;
  account: {
    type: "CHECKING" | "CREDIT";
  };
};

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameOrPast(date: Date | null): boolean {
  const days = daysFromNow(date);
  return days !== null && days < 0;
}

function hasAnyKeyword(value: string, keywords: string[]): boolean {
  const n = normalizeText(value);
  return keywords.some((keyword) => n.includes(normalizeText(keyword)));
}

function looksLikeCheckingIncome(description: string): boolean {
  return hasAnyKeyword(description, [
    "abono",
    "recibida",
    "recepcion",
    "nomina",
    "bonifica",
    "deposito",
  ]);
}

function isInternalCreditCardPayment(description: string): boolean {
  return hasAnyKeyword(description, [
    "cargo pago tarjeta credito",
    "pago tarjeta credito",
    "pago de tarjeta de credito",
    "pago a tarjeta",
    "pago de tarjeta",
  ]);
}

function inferBankCategory(description: string, fallback: string | null): string {
  if (fallback) return fallback;
  if (isInternalCreditCardPayment(description)) return "Pago a tarjeta";
  if (hasAnyKeyword(description, ["nomina", "recibida", "recepcion", "deposito", "abono"])) return "Ingresos";
  if (hasAnyKeyword(description, ["volkswagen", "domiciliacion", "servicio", "cfe", "telcel", "telmex"])) return "Servicios";
  if (hasAnyKeyword(description, ["costco", "soriana", "walmart", "chedraui", "super", "cosco"])) return "Supermercado";
  if (hasAnyKeyword(description, ["rest", "sushi", "tok", "taquer", "pizza", "hamburg", "comida"])) return "Restaurantes";
  if (hasAnyKeyword(description, ["uber", "didi", "gasolin", "pemex", "shell", "bp "])) return "Transporte";
  if (hasAnyKeyword(description, ["netflix", "spotify", "apple", "google", "disney", "xbox"])) return "Suscripciones";
  if (hasAnyKeyword(description, ["farmacia", "hospital", "medic", "dental"])) return "Salud";
  if (hasAnyKeyword(description, ["transferencia", "spei", "transf"])) return "Transferencias";
  return "Otros";
}

function buildBankCashflow(transactions: BankCashflowTransaction[]) {
  const incomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  const variableCatAgg = new Map<string, number>();

  for (const t of transactions) {
    const key = monthKey(new Date(t.transactionDate));
    const charge = toNum(t.chargeAmount);
    const credit = toNum(t.creditAmount);

    if (t.account.type === "CHECKING") {
      const chargeIsIncome = charge > 0 && looksLikeCheckingIncome(t.description);
      if (credit > 0 || chargeIsIncome) {
        const amount = credit > 0 ? credit : charge;
        incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
        continue;
      }

      if (charge > 0 && !isInternalCreditCardPayment(t.description)) {
        expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + charge);
        const cat = inferBankCategory(t.description, t.category);
        variableCatAgg.set(cat, (variableCatAgg.get(cat) ?? 0) + charge);
      }
      continue;
    }

    if (t.account.type === "CREDIT" && charge > 0) {
      // Credit-card charges are real spending. Credit-card credits are payments
      // from another account and should not be counted as income.
      expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + charge);
      const cat = inferBankCategory(t.description, t.category);
      variableCatAgg.set(cat, (variableCatAgg.get(cat) ?? 0) + charge);
    }
  }

  return { incomeByMonth, expenseByMonth, variableCatAgg };
}

function estimateCreditCardDueDate(statement: BankStatement): Date | null {
  const base = statement.cutDate ?? statement.periodEnd;
  return base ? addDays(base, ESTIMATED_CREDIT_CARD_DUE_DAYS) : null;
}

function accountDisplayName(account: BankAccount): string {
  const last4 = account.cardNumber ? ` ${account.cardNumber}` : "";
  return `${account.bankName} ${account.productName}${last4}`.replace(/\s+/g, " ").trim();
}

function buildCreditStatementItems(accounts: CreditAccountWithStatements[]): PaymentPlanItem[] {
  const items: PaymentPlanItem[] = [];

  for (const account of accounts) {
    const statements = [...account.statements].sort(
      (a, b) => a.periodEnd.getTime() - b.periodEnd.getTime()
    );
    if (statements.length === 0) continue;

    let balance: number | null = null;
    let inferredFromZero = false;
    let hasKnownBalance = false;

    for (const statement of statements) {
      if (statement.openingBalance !== null) {
        balance = toNum(statement.openingBalance);
        hasKnownBalance = true;
      }

      if (statement.closingBalance !== null) {
        balance = toNum(statement.closingBalance);
        hasKnownBalance = true;
      } else {
        if (balance === null) {
          balance = 0;
          inferredFromZero = true;
        }
        balance = Math.max(
          0,
          roundMoney(balance + toNum(statement.totalCharges) - toNum(statement.totalCredits))
        );
      }
    }

    const latest = statements[statements.length - 1];
    const amount = roundMoney(balance ?? 0);
    if (amount <= 0) continue;

    const dueDate = estimateCreditCardDueDate(latest);
    const status = isSameOrPast(dueDate) ? "OVERDUE" : "PENDING";
    const dueIn = daysFromNow(dueDate);
    const confidenceLabel = inferredFromZero && !hasKnownBalance
      ? "saldo inferido con movimientos importados; el XML no trae saldo inicial"
      : latest.closingBalance !== null
        ? "saldo final leído del estado de cuenta"
        : "saldo reconstruido desde el último saldo conocido";

    let recommendedAction = "Liquidar saldo al corte";
    if (status === "OVERDUE") recommendedAction = "Pagar de inmediato";
    else if (dueIn !== null && dueIn <= 7) recommendedAction = "Pagar esta semana";
    else if (dueIn !== null && dueIn <= 15) recommendedAction = "Programar pago";

    items.push({
      priority: 0,
      sourceModel: "BankStatement",
      id: `statement-${latest.id}`,
      name: accountDisplayName(account),
      amount,
      dueDate: dueDate?.toISOString().slice(0, 10) ?? null,
      status,
      category: "Tarjeta de crédito",
      paymentMethod: "CREDIT_CARD",
      recommendedAction,
      reason: `Último corte ${latest.cutDate?.toISOString().slice(0, 10) ?? latest.periodEnd.toISOString().slice(0, 10)}; fecha límite estimada a ${ESTIMATED_CREDIT_CARD_DUE_DAYS} días del corte; ${confidenceLabel}`,
    });
  }

  return items;
}

// ─── Forecast ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function buildForecast(summary: RecoveryPlanSummary): ForecastData | null {
  const { availableForDebt, overdueTotal, pendingTotal } = summary;
  if (availableForDebt === null || availableForDebt <= 0) return null;

  const totalDebt = overdueTotal + pendingTotal;
  const monthsToClear = totalDebt === 0 ? 0 : Math.ceil(totalDebt / availableForDebt);

  const now = new Date();
  const projections: MonthProjection[] = [{
    month: "Hoy",
    remainingDebt: totalDebt,
    cumulativePaid: 0,
  }];

  let remaining = totalDebt;
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    remaining = Math.max(0, remaining - availableForDebt);
    projections.push({
      month: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
      remainingDebt: remaining,
      cumulativePaid: Math.min(totalDebt, availableForDebt * i),
    });
  }

  return { projections, monthsToClear, totalDebt, monthlyPaymentCapacity: availableForDebt };
}

// ─── Score financiero ─────────────────────────────────────────────────────────

function buildFinancialScore(
  incomeAvg: number | null,
  freeCashflow: number | null,
  overdueTotal: number,
  dueIn7Total: number,
  dueIn15Total: number,
  pendingTotal: number,
  incomeByMonth: Map<string, number>,
  expenseByMonth: Map<string, number>,
): FinancialScore | null {
  const hasAnyData =
    incomeAvg !== null || overdueTotal > 0 || pendingTotal > 0 || dueIn7Total > 0;
  if (!hasAnyData) return null;

  const confidence: FinancialScore["confidence"] = incomeAvg !== null ? "full" : "partial";

  // Componente 1: Flujo libre (0-40 pts)
  let cashflow = 0;
  if (freeCashflow !== null && incomeAvg !== null && incomeAvg > 0) {
    const ratio = freeCashflow / incomeAvg;
    if (ratio >= 0.30) cashflow = 40;
    else if (ratio >= 0.20) cashflow = 32;
    else if (ratio >= 0.10) cashflow = 22;
    else if (ratio >= 0.00) cashflow = 10;
  }

  // Componente 2: Deuda vencida (0-35 pts)
  let overdueDebt: number;
  if (overdueTotal === 0) {
    overdueDebt = 35;
  } else if (incomeAvg !== null && incomeAvg > 0) {
    const ratio = overdueTotal / incomeAvg;
    if (ratio < 0.05) overdueDebt = 28;
    else if (ratio < 0.15) overdueDebt = 18;
    else if (ratio < 0.30) overdueDebt = 8;
    else overdueDebt = 0;
  } else {
    overdueDebt = 0; // sin ingreso + deuda vencida = peor caso
  }

  // Componente 3: Urgencia (0-25 pts)
  let urgency: number;
  if (dueIn7Total > 0) urgency = 8;
  else if (dueIn15Total > 0) urgency = 15;
  else urgency = 25;

  const score = cashflow + overdueDebt + urgency;

  let label: string;
  let colorKey: FinancialScore["colorKey"];
  if (score >= 80) { label = "Excelente"; colorKey = "green"; }
  else if (score >= 65) { label = "Bueno"; colorKey = "blue"; }
  else if (score >= 45) { label = "Regular"; colorKey = "yellow"; }
  else if (score >= 25) { label = "Ajustado"; colorKey = "orange"; }
  else { label = "Crítico"; colorKey = "red"; }

  // Tendencia: comparar el flujo del mes más reciente vs el anterior
  let trend: FinancialScore["trend"] = "unknown";
  let trendLabel = "Sin comparativa";

  const allMonths = [
    ...new Set([...incomeByMonth.keys(), ...expenseByMonth.keys()]),
  ].sort();

  if (allMonths.length >= 2) {
    const lastM = allMonths[allMonths.length - 1];
    const prevM = allMonths[allMonths.length - 2];
    const lastInc = incomeByMonth.get(lastM) ?? 0;
    const lastExp = expenseByMonth.get(lastM) ?? 0;
    const prevInc = incomeByMonth.get(prevM) ?? 0;
    const prevExp = expenseByMonth.get(prevM) ?? 0;

    if (lastInc > 0 && prevInc > 0) {
      const lastRatio = (lastInc - lastExp) / lastInc;
      const prevRatio = (prevInc - prevExp) / prevInc;
      const delta = lastRatio - prevRatio;

      if (delta > 0.05) { trend = "up"; trendLabel = "Mejora vs mes anterior"; }
      else if (delta < -0.05) { trend = "down"; trendLabel = "Baja vs mes anterior"; }
      else { trend = "stable"; trendLabel = "Estable vs mes anterior"; }
    }
  }

  return {
    score,
    label,
    colorKey,
    confidence,
    trend,
    trendLabel,
    breakdown: { cashflow, overdueDebt, urgency },
  };
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function getRecoveryPlan(
  userId: string,
  months: number = 3
): Promise<RecoveryPlan> {
  const safeMonths = Math.max(1, Math.min(months, 12));
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - safeMonths, 1, 0, 0, 0, 0);

  const [activePayments, recentPaid, recentTransactions, creditAccounts, rawSnapshots] = await Promise.all([
    prisma.personalPayment.findMany({
      where: { userId, status: { in: ["PENDING", "OVERDUE"] } },
      include: { category: true, card: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.personalPayment.findMany({
      where: {
        userId,
        status: "PAID",
        OR: [
          { paymentDate: { gte: periodStart } },
          { createdAt: { gte: periodStart } },
        ],
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bankTransaction.findMany({
      where: {
        account: { userId },
        transactionDate: { gte: periodStart },
      },
      select: {
        transactionDate: true,
        chargeAmount: true,
        creditAmount: true,
        description: true,
        category: true,
        account: {
          select: {
            type: true,
          },
        },
      },
    }),
    prisma.bankAccount.findMany({
      where: {
        userId,
        type: "CREDIT",
        active: true,
        statements: { some: {} },
      },
      include: {
        statements: {
          orderBy: { periodEnd: "asc" },
        },
      },
      orderBy: [
        { bankName: "asc" },
        { productName: "asc" },
      ],
    }),
    prisma.financialSnapshot.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: 12,
      select: {
        date: true,
        score: true,
        scoreLabel: true,
        financialStatus: true,
        overdueTotal: true,
        pendingTotal: true,
        freeCashflow: true,
      },
    }),
  ]);

  // ─── Segmentar pagos ────────────────────────────────────────────────────────
  const overduePayments = activePayments.filter((p) => p.status === "OVERDUE");
  const pendingPayments = activePayments.filter((p) => p.status === "PENDING");
  const creditStatementItems = buildCreditStatementItems(creditAccounts);
  const overdueCreditStatements = creditStatementItems.filter((p) => p.status === "OVERDUE");
  const pendingCreditStatements = creditStatementItems.filter((p) => p.status === "PENDING");

  const dueIn7 = pendingPayments.filter((p) => {
    const d = daysFromNow(p.dueDate);
    return d !== null && d >= 0 && d <= 7;
  });
  const creditDueIn7 = pendingCreditStatements.filter((p) => {
    const d = p.dueDate ? daysFromNow(new Date(p.dueDate)) : null;
    return d !== null && d >= 0 && d <= 7;
  });

  const dueIn15 = pendingPayments.filter((p) => {
    const d = daysFromNow(p.dueDate);
    return d !== null && d >= 0 && d <= 15;
  });
  const creditDueIn15 = pendingCreditStatements.filter((p) => {
    const d = p.dueDate ? daysFromNow(new Date(p.dueDate)) : null;
    return d !== null && d >= 0 && d <= 15;
  });

  // ─── Análisis histórico ─────────────────────────────────────────────────────
  const incomePayments = recentPaid.filter((p) =>
    isIncome(p.financialClass, p.type, p.category?.name ?? "")
  );
  const expensePayments = recentPaid.filter((p) =>
    !isIncome(p.financialClass, p.type, p.category?.name ?? "")
  );

  const incomeByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();
  const fixedByMonth = new Map<string, number>();
  const variableByMonth = new Map<string, number>();

  for (const p of incomePayments) {
    const key = monthKey(p.paymentDate ?? p.createdAt);
    incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + toNum(p.amount));
  }

  for (const p of expensePayments) {
    const key = monthKey(p.paymentDate ?? p.createdAt);
    expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + toNum(p.amount));
    if (p.period !== "ONCE") {
      fixedByMonth.set(key, (fixedByMonth.get(key) ?? 0) + toNum(p.amount));
    } else {
      variableByMonth.set(key, (variableByMonth.get(key) ?? 0) + toNum(p.amount));
    }
  }

  const bankCashflow = buildBankCashflow(recentTransactions);
  const usesBankCashflow =
    bankCashflow.incomeByMonth.size > 0 || bankCashflow.expenseByMonth.size > 0;

  function avgMap(m: Map<string, number>): number | null {
    if (m.size === 0) return null;
    const total = Array.from(m.values()).reduce((a, b) => a + b, 0);
    return total / m.size;
  }

  const cashflowIncomeByMonth = usesBankCashflow ? bankCashflow.incomeByMonth : incomeByMonth;
  const cashflowExpenseByMonth = usesBankCashflow ? bankCashflow.expenseByMonth : expenseByMonth;

  const monthlyIncomeAvg = avgMap(cashflowIncomeByMonth);
  const monthlyExpenseAvg = avgMap(cashflowExpenseByMonth);

  const fixedExpensesAvg = avgMap(fixedByMonth);
  const variableExpensesAvg = usesBankCashflow
    ? avgMap(bankCashflow.expenseByMonth)
    : avgMap(variableByMonth);

  // ─── Totales ────────────────────────────────────────────────────────────────
  const overdueTotal =
    overduePayments.reduce((s, p) => s + toNum(p.amount), 0) +
    overdueCreditStatements.reduce((s, p) => s + p.amount, 0);
  const pendingTotal =
    pendingPayments.reduce((s, p) => s + toNum(p.amount), 0) +
    pendingCreditStatements.reduce((s, p) => s + p.amount, 0);
  const dueIn7Total =
    dueIn7.reduce((s, p) => s + toNum(p.amount), 0) +
    creditDueIn7.reduce((s, p) => s + p.amount, 0);
  const dueIn15Total =
    dueIn15.reduce((s, p) => s + toNum(p.amount), 0) +
    creditDueIn15.reduce((s, p) => s + p.amount, 0);

  // ─── Flujo libre ────────────────────────────────────────────────────────────
  let freeCashflow: number | null = null;
  let availableForDebt: number | null = null;

  if (monthlyIncomeAvg !== null && monthlyExpenseAvg !== null) {
    freeCashflow = monthlyIncomeAvg - monthlyExpenseAvg;
    availableForDebt = Math.max(0, freeCashflow - BASIC_RESERVE_MXN);
  }

  // ─── Estado financiero ──────────────────────────────────────────────────────
  let financialStatus: FinancialStatus = "unknown";

  if (monthlyIncomeAvg !== null) {
    const safeIncome = Math.max(monthlyIncomeAvg, 1);
    if (overdueTotal > 0 && overdueTotal / safeIncome > 0.5) {
      financialStatus = "critical";
    } else if (overdueTotal > 0 || (freeCashflow !== null && freeCashflow < 0)) {
      financialStatus = "tight";
    } else if (availableForDebt !== null && availableForDebt < safeIncome * 0.1) {
      financialStatus = "tight";
    } else if (availableForDebt !== null && availableForDebt < safeIncome * 0.2) {
      financialStatus = "stable";
    } else if (availableForDebt !== null) {
      financialStatus = "healthy";
    }
  } else if (overdueTotal > 0) {
    financialStatus = "critical";
  }

  // ─── Matriz priorizada ──────────────────────────────────────────────────────
  const paymentPlan: PaymentPlanItem[] = [];
  let priority = 1;

  for (const p of [...overduePayments].sort((a, b) => toNum(b.amount) - toNum(a.amount))) {
    paymentPlan.push({
      priority: priority++,
      sourceModel: "PersonalPayment",
      id: p.id,
      name: p.name,
      amount: toNum(p.amount),
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      category: p.category?.name ?? "Sin categoría",
      paymentMethod: p.paymentMethod,
      recommendedAction: "Pagar de inmediato",
      reason: "Pago vencido — riesgo de penalizaciones e impacto en historial crediticio",
    });
  }

  for (const p of [...overdueCreditStatements]
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return da - db || b.amount - a.amount;
    })) {
    paymentPlan.push({ ...p, priority: priority++ });
  }

  const inPlanIds = new Set(paymentPlan.map((i) => i.id));
  for (const p of [...dueIn7]
    .filter((p) => !inPlanIds.has(p.id))
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))) {
    const days = daysFromNow(p.dueDate);
    paymentPlan.push({
      priority: priority++,
      sourceModel: "PersonalPayment",
      id: p.id,
      name: p.name,
      amount: toNum(p.amount),
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      category: p.category?.name ?? "Sin categoría",
      paymentMethod: p.paymentMethod,
      recommendedAction: "Pagar esta semana",
      reason: days === 0 ? "Vence hoy" : `Vence en ${days} día${days === 1 ? "" : "s"}`,
    });
    inPlanIds.add(p.id);
  }

  for (const p of [...creditDueIn7]
    .filter((p) => !inPlanIds.has(p.id))
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db || b.amount - a.amount;
    })) {
    paymentPlan.push({ ...p, priority: priority++ });
    inPlanIds.add(p.id);
  }

  for (const p of pendingPayments
    .filter((p) => !inPlanIds.has(p.id) && p.period !== "ONCE" && p.dueDate !== null)
    .filter((p) => {
      const d = daysFromNow(p.dueDate);
      return d !== null && d > 7 && d <= 15;
    })
    .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))) {
    paymentPlan.push({
      priority: priority++,
      sourceModel: "PersonalPayment",
      id: p.id,
      name: p.name,
      amount: toNum(p.amount),
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      category: p.category?.name ?? "Sin categoría",
      paymentMethod: p.paymentMethod,
      recommendedAction: "Programar pago",
      reason: "Gasto recurrente próximo a vencer",
    });
    inPlanIds.add(p.id);
  }

  for (const p of [...creditDueIn15]
    .filter((p) => !inPlanIds.has(p.id))
    .sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db || b.amount - a.amount;
    })) {
    paymentPlan.push({ ...p, priority: priority++ });
    inPlanIds.add(p.id);
  }

  for (const p of [...pendingPayments]
    .filter((p) => !inPlanIds.has(p.id))
    .sort((a, b) => toNum(b.amount) - toNum(a.amount))
    .slice(0, 20)) {
    const isRecurring = p.period !== "ONCE";
    const days = daysFromNow(p.dueDate);
    paymentPlan.push({
      priority: priority++,
      sourceModel: "PersonalPayment",
      id: p.id,
      name: p.name,
      amount: toNum(p.amount),
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      status: p.status,
      category: p.category?.name ?? "Sin categoría",
      paymentMethod: p.paymentMethod,
      recommendedAction: isRecurring ? "Incluir en presupuesto mensual" : "Evaluar y liquidar",
      reason: isRecurring
        ? "Compromiso recurrente"
        : days !== null && days > 0
          ? `Vence en ${days} días`
          : "Pago pendiente sin fecha límite definida",
    });
  }

  for (const p of [...pendingCreditStatements]
    .filter((p) => !inPlanIds.has(p.id))
    .sort((a, b) => b.amount - a.amount)) {
    paymentPlan.push({ ...p, priority: priority++ });
    inPlanIds.add(p.id);
  }

  // ─── Sugerencias de recorte ─────────────────────────────────────────────────
  const cutSuggestions: CutSuggestion[] = [];
  const variableCatAgg = usesBankCashflow
    ? bankCashflow.variableCatAgg
    : new Map<string, number>();
  const recentMonths = Math.max(expenseByMonth.size, 1);

  if (!usesBankCashflow) {
    for (const p of expensePayments.filter((p) => p.period === "ONCE")) {
      const cat = p.category?.name ?? "Sin categoría";
      variableCatAgg.set(cat, (variableCatAgg.get(cat) ?? 0) + toNum(p.amount));
    }
  }

  const suggestionMonths = usesBankCashflow
    ? Math.max(bankCashflow.expenseByMonth.size, 1)
    : recentMonths;

  for (const [cat, total] of [...variableCatAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)) {
    const monthly = total / suggestionMonths;
    if (monthly > 100) {
      cutSuggestions.push({
        category: cat,
        monthlyAmount: Math.round(monthly * 100) / 100,
        suggestedReduction: Math.round(monthly * 0.3 * 100) / 100,
        reason: "Gasto variable no recurrente — reducción del 30% libera flujo sin afectar compromisos fijos",
      });
    }
  }

  // ─── Insights ───────────────────────────────────────────────────────────────
  const insights: RecoveryInsight[] = [];

  if (overdueTotal > 0) {
    insights.push({
      type: "risk",
      title: "Tienes pagos vencidos",
      message: `Debes ${fmtMXN(overdueTotal)} en pagos vencidos. Cada día sin pagar puede generar intereses, cargos por mora y afectar tu historial crediticio.`,
      suggestedAction: "Liquida primero lo vencido antes de cualquier gasto discrecional.",
    });
  }

  if (dueIn7Total > 0) {
    insights.push({
      type: "warning",
      title: `${fmtMXN(dueIn7Total)} vencen en 7 días`,
      message: `Tienes ${dueIn7.length} pago${dueIn7.length === 1 ? "" : "s"} que vence${dueIn7.length === 1 ? "" : "n"} esta semana. Revisa tu disponible ahora.`,
      suggestedAction: "Programa estos pagos hoy para evitar que pasen a vencidos.",
    });
  }

  if (freeCashflow !== null && freeCashflow < 0) {
    insights.push({
      type: "risk",
      title: "Egresos superan ingresos",
      message: `Tu egreso mensual promedio supera tu ingreso registrado en ${fmtMXN(Math.abs(freeCashflow ?? 0))}. Estás en déficit operativo.`,
      suggestedAction: "Identifica y elimina gastos variables no esenciales este mes para revertir el déficit.",
    });
  } else if (freeCashflow !== null && freeCashflow > 0 && overdueTotal > 0) {
    const monthsToClear = Math.ceil(overdueTotal / freeCashflow);
    insights.push({
      type: "warning",
      title: "Tienes flujo, pero hay deuda vencida",
      message: `Con tu flujo libre de ${fmtMXN(freeCashflow)}/mes y ${fmtMXN(overdueTotal)} vencido, podrías ponerte al corriente en ${monthsToClear} mes${monthsToClear === 1 ? "" : "es"} destinando todo el excedente.`,
      suggestedAction: "Aplica el flujo libre a los pagos vencidos antes de gastos opcionales.",
    });
  }

  if (monthlyIncomeAvg === null) {
    insights.push({
      type: "info",
      title: "Sin datos de ingreso detectados",
      message: "No se encontraron registros de ingreso en los últimos meses. El análisis financiero es parcial.",
      suggestedAction: "Registra tus ingresos en categorías como 'Sueldo', 'Depósito' o 'Ingreso' para mejorar el análisis.",
    });
  }

  if (cutSuggestions.length > 0) {
    const totalSavings = cutSuggestions.reduce((s, c) => s + c.suggestedReduction, 0);
    insights.push({
      type: "opportunity",
      title: `Puedes liberar hasta ${fmtMXN(totalSavings)}/mes`,
      message: `Reduciendo gastos variables en las categorías sugeridas podrías liberar ${fmtMXN(totalSavings)} al mes sin tocar compromisos fijos.`,
      suggestedAction: "Revisa la sección 'Qué recortar' y aplica las reducciones que sean factibles.",
    });
  }

  if (creditStatementItems.length > 0) {
    const totalCreditDebt = creditStatementItems.reduce((s, p) => s + p.amount, 0);
    insights.push({
      type: overdueCreditStatements.length > 0 ? "warning" : "info",
      title: `${fmtMXN(totalCreditDebt)} en saldos de tarjeta`,
      message: `El plan incluye ${creditStatementItems.length} tarjeta${creditStatementItems.length === 1 ? "" : "s"} con saldo tomado del último estado de cuenta importado. Las fechas límite se estiman como corte + ${ESTIMATED_CREDIT_CARD_DUE_DAYS} días.`,
      suggestedAction: "Prioriza estos saldos por fecha límite y evita nuevos cargos hasta estabilizar el flujo.",
    });
  }

  if (financialStatus === "healthy") {
    insights.push({
      type: "info",
      title: "Estado financiero saludable",
      message: "Tu flujo libre es positivo, no hay pagos vencidos y tienes margen de maniobra.",
      suggestedAction: "Considera destinar el excedente a ahorro de emergencia o pago anticipado de deudas.",
    });
  }

  if (
    pendingPayments.length === 0 &&
    overduePayments.length === 0 &&
    creditStatementItems.length === 0 &&
    recentPaid.length === 0 &&
    recentTransactions.length === 0
  ) {
    insights.push({
      type: "info",
      title: "Sin registros financieros",
      message: "No hay pagos registrados aún. El análisis no puede generar un plan confiable.",
      suggestedAction: "Registra tus ingresos, gastos y deudas para activar el plan de recuperación.",
    });
  }

  // ─── Calidad de datos ───────────────────────────────────────────────────────
  const hasExplicitClassification = recentPaid.some(
    (p) => p.financialClass != null || p.type != null
  );
  const hasInferredCreditDebt = creditStatementItems.some((item) =>
    item.reason.includes("saldo inferido")
  );
  const missingFields: string[] = [];

  if (!usesBankCashflow && recentPaid.length > 0 && !hasExplicitClassification) {
    missingFields.push("PersonalPayment.financialClass");
  }

  if (hasInferredCreditDebt) {
    missingFields.push("BankStatement.closingBalance");
  }

  const dataQuality: DataQuality = {
    hasIncomeData: monthlyIncomeAvg !== null,
    hasExpenseData: monthlyExpenseAvg !== null,
    hasPendingPayments: pendingPayments.length > 0 || pendingCreditStatements.length > 0,
    hasOverduePayments: overduePayments.length > 0 || overdueCreditStatements.length > 0,
    missingFields,
  };

  const financialScore = buildFinancialScore(
    monthlyIncomeAvg,
    freeCashflow,
    overdueTotal,
    dueIn7Total,
    dueIn15Total,
    pendingTotal,
    cashflowIncomeByMonth,
    cashflowExpenseByMonth,
  );

  const summaryObj: RecoveryPlanSummary = {
    monthlyIncomeAvg,
    monthlyExpenseAvg,
    fixedExpensesAvg,
    variableExpensesAvg,
    pendingTotal,
    overdueTotal,
    dueIn7DaysTotal: dueIn7Total,
    dueIn15DaysTotal: dueIn15Total,
    freeCashflow,
    availableForDebt,
    financialStatus,
  };

  // ─── Snapshots ────────────────────────────────────────────────────────────────
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthKey = monthKey(monthStart);

  const currentSnapshot: SnapshotPoint = {
    date: currentMonthKey,
    score: financialScore?.score ?? null,
    scoreLabel: financialScore?.label ?? null,
    financialStatus,
    overdueTotal,
    pendingTotal,
    freeCashflow,
  };

  const existingSnapshots: SnapshotPoint[] = rawSnapshots.map((s) => ({
    date: monthKey(new Date(s.date)),
    score: s.score,
    scoreLabel: s.scoreLabel,
    financialStatus: s.financialStatus,
    overdueTotal: toNum(s.overdueTotal),
    pendingTotal: toNum(s.pendingTotal),
    freeCashflow: s.freeCashflow !== null ? toNum(s.freeCashflow) : null,
  }));

  const snapshots: SnapshotPoint[] = [
    ...existingSnapshots.filter((s) => s.date !== currentMonthKey),
    currentSnapshot,
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Persistir snapshot del mes actual antes de responder evita carreras con el ciclo de request.
  await prisma.financialSnapshot.upsert({
    where: { userId_date: { userId, date: monthStart } },
    update: {
      score: currentSnapshot.score,
      scoreLabel: currentSnapshot.scoreLabel,
      financialStatus: currentSnapshot.financialStatus,
      overdueTotal: currentSnapshot.overdueTotal,
      pendingTotal: currentSnapshot.pendingTotal,
      freeCashflow: currentSnapshot.freeCashflow,
    },
    create: {
      userId,
      date: monthStart,
      score: currentSnapshot.score,
      scoreLabel: currentSnapshot.scoreLabel,
      financialStatus: currentSnapshot.financialStatus,
      overdueTotal: currentSnapshot.overdueTotal,
      pendingTotal: currentSnapshot.pendingTotal,
      freeCashflow: currentSnapshot.freeCashflow,
    },
  }).catch((e) => console.error("[recovery-plan] snapshot upsert error:", e));

  return {
    summary: summaryObj,
    paymentPlan,
    cutSuggestions,
    insights,
    dataQuality,
    financialScore,
    forecast: buildForecast(summaryObj),
    snapshots,
    months: safeMonths,
  };
}
