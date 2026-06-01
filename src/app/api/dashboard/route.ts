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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const { searchParams } = new URL(req.url);
  const requestedFrom = parseDateParam(searchParams.get("from"));
  const requestedTo = parseDateParam(searchParams.get("to"));
  const granularityParam = searchParams.get("granularity");
  const granularity = granularityParam === "day" || granularityParam === "week" ? granularityParam : "month";
  const from = requestedFrom ? startOfDay(requestedFrom) : new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const to = requestedTo ? endOfDay(requestedTo) : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const [
    allPayments,
    paymentsByPeriod,
    upcomingDue,
    pantryLowStock,
    pantryExpiring,
    _recentPaymentsBase,
  ] = await Promise.all([
    prisma.payment.findMany({
      include: { category: true, paidBy: { select: { name: true } } },
    }),
    // Por periodo
    prisma.payment.groupBy({
      by: ["period"],
      _sum: { amount: true },
      _count: true,
    }),
    // Próximos vencimientos (15 días)
    prisma.payment.findMany({
      where: { status: "PENDING", dueDate: { gte: now, lte: next15Days } },
      include: { category: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    // Despensa: stock bajo
    prisma.pantryItem.findMany({
      where: { active: true },
      include: { category: true },
    }).then((items) => items.filter((i) => Number(i.quantity) <= Number(i.minStock))),
    // Despensa: por vencer
    prisma.pantryItem.findMany({
      where: { active: true, expiryDate: { lte: next15Days, gte: now } },
      include: { category: true },
    }),
    // Últimos pagos (base)
    prisma.payment.findMany({
      take: 100,
      orderBy: { registeredAt: "desc" },
      include: { category: true, paidBy: { select: { name: true } } },
    }),
  ]);

  const filteredPayments = allPayments.filter((p) => {
    const effectiveDate = p.paymentDate ?? p.registeredAt;
    return inRange(effectiveDate, from, to);
  });

  const paidPayments = filteredPayments.filter((p) => p.status === "PAID");
  const totalPayments = filteredPayments.length;
  const pendingPayments = filteredPayments.filter((p) => p.status === "PENDING").length;
  const overduePayments = filteredPayments.filter((p) => p.status === "OVERDUE").length;
  const recentPayments = [...filteredPayments]
    .sort((a, b) => (b.paymentDate ?? b.registeredAt).getTime() - (a.paymentDate ?? a.registeredAt).getTime())
    .slice(0, 5);

  const categoryAgg = new Map<string, { amount: number; count: number; color: string; received: boolean }>();
  const methodAgg = new Map<string, { amount: number; count: number }>();
  const flowAgg = new Map<string, { label: string; spent: number; received: number }>();

  let paidTotal = 0;
  let receivedTotal = 0;
  let savingsTotal = 0;

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
      savingsTotal += amount;
    } else if (received) {
      receivedTotal += amount;
    } else {
      paidTotal += amount;
    }

    const catCurrent = categoryAgg.get(categoryName) ?? { amount: 0, count: 0, color: categoryColor, received };
    catCurrent.amount += amount;
    catCurrent.count += 1;
    catCurrent.color = categoryColor;
    catCurrent.received = received;
    categoryAgg.set(categoryName, catCurrent);

    const methodCurrent = methodAgg.get(payment.paymentMethod) ?? { amount: 0, count: 0 };
    methodCurrent.amount += amount;
    methodCurrent.count += 1;
    methodAgg.set(payment.paymentMethod, methodCurrent);

    const baseDate = payment.paymentDate ?? payment.registeredAt;
    const flowDate = new Date(baseDate);
    const key = granularity === "day"
      ? dayKey(flowDate)
      : granularity === "week"
        ? `w${Math.floor(daysDiff(from, flowDate) / 7) + 1}`
        : monthKey(flowDate);
    const monthRow = flowAgg.get(key);
    if (monthRow) {
      if (received) monthRow.received += amount;
      else if (!savings) monthRow.spent += amount;
    }
  }

  const paymentsByCategory = Array.from(categoryAgg.entries())
    .map(([category, agg]) => ({
      category,
      color: agg.color,
      amount: agg.amount,
      count: agg.count,
      received: agg.received,
    }))
    .sort((a, b) => b.amount - a.amount);

  const paymentsByMethod = Array.from(methodAgg.entries())
    .map(([paymentMethod, agg]) => ({
      paymentMethod,
      _sum: { amount: agg.amount },
      _count: agg.count,
    }))
    .sort((a, b) => Number(b._sum.amount) - Number(a._sum.amount));

  const monthlyFlow = Array.from(flowAgg.values());

  return NextResponse.json({
    filters: { from, to },
    summary: {
      totalPayments,
      pendingPayments,
      overduePayments,
      paidInRange: paidTotal,
      receivedInRange: receivedTotal,
      savingsInRange: savingsTotal,
    },
    paymentsByCategory,
    paymentsByMethod,
    paymentsByPeriod,
    monthlyFlow,
    flowGranularity: granularity,
    upcomingDue,
    pantryAlerts: {
      lowStock: pantryLowStock,
      expiring: pantryExpiring,
    },
    recentPayments,
  });
}
