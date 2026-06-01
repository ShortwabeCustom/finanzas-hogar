import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isReceivedCategory(name: string): boolean {
  const n = normalizeText(name);
  return n.includes("deposito") || n.includes("abono") || n.includes("transferencias recibidas");
}

function isSavingsCategory(name: string): boolean {
  return normalizeText(name).includes("ahorro");
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

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

function daysDiff(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function inRange(date: Date, from: Date, to: Date): boolean {
  const t = date.getTime();
  return t >= from.getTime() && t <= to.getTime();
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
    const granularity = granularityParam === "day" || granularityParam === "week" ? granularityParam : "month";
    const from = requestedFrom ? startOfDay(requestedFrom) : new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const to = requestedTo ? endOfDay(requestedTo) : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const allPayments = await prisma.personalPayment.findMany({
      where: { userId },
      include: { category: true },
    });

    const filteredPayments = allPayments.filter((p) => {
      const effectiveDate = p.paymentDate ?? p.createdAt;
      return inRange(effectiveDate, from, to);
    });

    const paidPayments = filteredPayments.filter((p) => p.status === "PAID");
    const totalCount = filteredPayments.length;
    const pendingCount = filteredPayments.filter((p) => p.status === "PENDING").length;
    const overdueCount = filteredPayments.filter((p) => p.status === "OVERDUE").length;
    const upcoming = allPayments
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
    const overdueTotal = allPayments
      .filter((p) => p.status === "OVERDUE")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const pendingTotal = allPayments
      .filter((p) => p.status === "PENDING")
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);

    // ─── Ingreso promedio mensual (últimos 3 meses) ────────────────────────────
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);
    const incomeByMonth = new Map<string, number>();
    for (const p of allPayments) {
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
    const flowAgg = new Map<string, { label: string; spent: number; received: number }>();

    let paidInRange = 0;
    let receivedInRange = 0;
    let savingsInRange = 0;

    if (granularity === "day") {
      const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
      const dayEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate());
      while (cursor <= dayEnd) {
        const key = dayKey(cursor);
        flowAgg.set(key, { label: dayLabel(cursor), spent: 0, received: 0 });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (granularity === "week") {
      const totalWeeks = Math.ceil((daysDiff(from, to) + 1) / 7);
      for (let week = 1; week <= totalWeeks; week += 1) {
        const key = `w${week}`;
        flowAgg.set(key, { label: `Sem ${week}`, spent: 0, received: 0 });
      }
    } else {
      const monthCursor = new Date(from.getFullYear(), from.getMonth(), 1);
      const monthEnd = new Date(to.getFullYear(), to.getMonth(), 1);
      while (monthCursor <= monthEnd) {
        const key = monthKey(monthCursor);
        flowAgg.set(key, { label: monthLabel(monthCursor), spent: 0, received: 0 });
        monthCursor.setMonth(monthCursor.getMonth() + 1);
      }
    }

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
      const flowDate = new Date(baseDate);
      const key = granularity === "day"
        ? dayKey(flowDate)
        : granularity === "week"
          ? `w${Math.floor(daysDiff(from, flowDate) / 7) + 1}`
          : monthKey(flowDate);
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
    });
  } catch (error) {
    console.error("[personal/dashboard]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
