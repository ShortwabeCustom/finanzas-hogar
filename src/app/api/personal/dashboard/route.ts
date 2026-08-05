import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateParam,
  startOfDay,
  endOfDay,
  monthKey,
  isReceivedCategory,
  isSavingsCategory,
  buildFlowAgg,
  flowKey,
  type FlowGranularity,
} from "@/lib/dashboard-utils";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isIncome(
  financialClass: string | null | undefined,
  type: string | null | undefined,
  categoryName: string
): boolean {
  if (financialClass === "INCOME") return true;
  if (financialClass === "EXPENSE" || financialClass === "TRANSFER" || financialClass === "SAVING") return false;
  if (type === "INCOME") return true;
  if (type === "EXPENSE" || type === "TRANSFER") return false;
  const n = normalizeText(categoryName);
  return (
    n.includes("deposito") || n.includes("abono") || n.includes("transferencias recibidas") ||
    n.includes("ingreso") || n.includes("sueldo") || n.includes("salario") ||
    n.includes("nomina") || n.includes("cobro")
  );
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // userId is always sourced from the session — never from the request
    const userId = session.user.id;
    const now = new Date();
    const { searchParams } = new URL(req.url);
    const requestedFrom = parseDateParam(searchParams.get("from"));
    const requestedTo = parseDateParam(searchParams.get("to"));
    const granularityParam = searchParams.get("granularity");
    const granularity: FlowGranularity = granularityParam === "day" || granularityParam === "week" ? granularityParam : "month";
    const from = requestedFrom ? startOfDay(requestedFrom) : new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = requestedTo ? endOfDay(requestedTo) : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);

    const [filteredPayments, globalPayments] = await Promise.all([
      // Date-filtered payments pushed to DB: paymentDate if set, else createdAt
      prisma.personalPayment.findMany({
        where: {
          userId,
          OR: [
            { paymentDate: { gte: from, lte: to } },
            { paymentDate: null, createdAt: { gte: from, lte: to } },
          ],
        },
        include: { category: true },
      }),
      // Global (unfiltered) — minimal select for debt totals, upcoming, income avg
      prisma.personalPayment.findMany({
        where: { userId },
        select: {
          id: true,
          folio: true,
          name: true,
          concept: true,
          amount: true,
          status: true,
          period: true,
          paymentMethod: true,
          dueDate: true,
          paymentDate: true,
          createdAt: true,
          financialClass: true,
          type: true,
          category: { select: { id: true, name: true, color: true } },
        },
      }),
    ]);

    const paidPayments = filteredPayments.filter((p) => p.status === "PAID");
    const totalCount = filteredPayments.length;
    const pendingCount = filteredPayments.filter((p) => p.status === "PENDING").length;
    const overdueCount = filteredPayments.filter((p) => p.status === "OVERDUE").length;
    const upcoming = globalPayments
      .filter((p) => p.status === "PENDING")
      .filter((p) => !!p.dueDate && p.dueDate >= now && p.dueDate <= next15Days)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .slice(0, 20);
    const recent = [...filteredPayments]
      .sort((a, b) => {
        const aDate = (a.paymentDate ?? a.createdAt).getTime();
        const bDate = (b.paymentDate ?? b.createdAt).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);

    // ─── Deuda total (snapshot global, no filtrada por periodo) ───────────────
    const overdueTotal = globalPayments
      .filter((p) => p.status === "OVERDUE")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const pendingTotal = globalPayments
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    // ─── Ingreso promedio mensual (últimos 3 meses) ────────────────────────────
    const incomeByMonth = new Map<string, number>();
    for (const p of globalPayments) {
      if (p.status !== "PAID") continue;
      const effectiveDate = p.paymentDate ?? p.createdAt;
      if (effectiveDate < threeMonthsAgo) continue;
      if (!isIncome(p.financialClass, p.type, p.category?.name ?? "")) continue;
      const key = monthKey(effectiveDate);
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + Number(p.amount ?? 0));
    }
    const monthlyIncomeAvg = incomeByMonth.size > 0
      ? Array.from(incomeByMonth.values()).reduce((a, b) => a + b, 0) / incomeByMonth.size
      : null;

    const categoryAgg = new Map<string, { total: number; count: number; color: string; received: boolean }>();
    const methodAgg = new Map<string, { total: number; count: number }>();
    const flowAgg = buildFlowAgg(from, to, granularity);

    let paidInRange = 0;
    let receivedInRange = 0;
    let savingsInRange = 0;

    for (const payment of paidPayments) {
      const amount = Number(payment.amount ?? 0);
      const categoryName = payment.category?.name ?? "Sin categoría";
      const categoryColor = payment.category?.color ?? "#6366f1";
      const received = isReceivedCategory(categoryName);
      const savings = isSavingsCategory(categoryName);

      if (savings) {
        savingsInRange += amount;
      } else if (received) {
        receivedInRange += amount;
      } else {
        paidInRange += amount;
      }

      const catCurrent = categoryAgg.get(categoryName) ?? { total: 0, count: 0, color: categoryColor, received };
      catCurrent.total += amount;
      catCurrent.count += 1;
      catCurrent.color = categoryColor;
      catCurrent.received = received;
      categoryAgg.set(categoryName, catCurrent);

      const methodCurrent = methodAgg.get(payment.paymentMethod) ?? { total: 0, count: 0 };
      methodCurrent.total += amount;
      methodCurrent.count += 1;
      methodAgg.set(payment.paymentMethod, methodCurrent);

      const baseDate = payment.paymentDate ?? payment.createdAt;
      const key = flowKey(new Date(baseDate), from, granularity);
      const row = flowAgg.get(key);
      if (row) {
        if (received) row.received += amount;
        else if (!savings) row.spent += amount;
      }
    }

    const byCategory = Array.from(categoryAgg.entries())
      .map(([name, agg]) => ({
        name,
        color: agg.color,
        total: agg.total,
        count: agg.count,
        received: agg.received,
      }))
      .sort((a, b) => b.total - a.total);

    const byMethod = Array.from(methodAgg.entries())
      .map(([method, agg]) => ({
        method,
        total: agg.total,
        count: agg.count,
      }))
      .sort((a, b) => b.total - a.total);

    const monthlyFlow = Array.from(flowAgg.values());

    // ─── Deudas Pendientes ────────────────────────────────────────────────────
    const debtAccounts = await prisma.debtAccount.findMany({
      where: { userId, status: "ACTIVE" },
      include: { installments: true, payments: true },
      orderBy: { nextDueDate: "asc" },
    });

    let totalPayable = 0;
    let totalReceivable = 0;
    let mostUrgent: any = null;
    const overdueDebts: any[] = [];
    let nextDueDate: Date | null = null;

    for (const debt of debtAccounts) {
      const balance = Number(debt.currentPrincipal || 0);

      if (debt.direction === "PAYABLE") {
        totalPayable += balance;
      } else {
        totalReceivable += balance;
      }

      // Track most urgent (soonest due date, payable only)
      if (debt.direction === "PAYABLE" && debt.nextDueDate) {
        if (!nextDueDate || debt.nextDueDate < nextDueDate) {
          nextDueDate = debt.nextDueDate;
        }
        if (!mostUrgent || (debt.nextDueDate && debt.nextDueDate < (mostUrgent.nextDueDate || new Date()))) {
          mostUrgent = {
            id: debt.id,
            name: debt.name,
            type: debt.type,
            currentPrincipal: balance,
            originalPrincipal: Number(debt.originalPrincipal || 0),
            nextDueDate: debt.nextDueDate,
          };
        }
      }

      // Track overdue (vencidas)
      if (debt.direction === "PAYABLE" && debt.nextDueDate && debt.nextDueDate < now) {
        const daysOverdue = Math.floor((now.getTime() - debt.nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
        overdueDebts.push({
          id: debt.id,
          name: debt.name,
          type: debt.type,
          daysOverdue,
        });
      }
    }

    const debts = {
      totalPayable,
      totalReceivable,
      nextDueDate,
      overdueCount: overdueDebts.length,
      mostUrgent,
      overdue: overdueDebts.slice(0, 5), // Top 5 overdue
    };

    return NextResponse.json({
      filters: { from, to },
      totalCount,
      pendingCount,
      overdueCount,
      overdueTotal,
      pendingTotal,
      monthlyIncomeAvg,
      paidInRange,
      receivedInRange,
      savingsInRange,
      byCategory,
      byMethod,
      monthlyFlow,
      flowGranularity: granularity,
      upcoming,
      recent,
      debts,
    });
  } catch (error) {
    console.error("[personal/dashboard]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
