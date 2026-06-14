import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateParam,
  startOfDay,
  endOfDay,
  isReceivedCategory,
  isSavingsCategory,
  buildFlowAgg,
  flowKey,
  type FlowGranularity,
} from "@/lib/dashboard-utils";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const { searchParams } = new URL(req.url);
  const requestedFrom = parseDateParam(searchParams.get("from"));
  const requestedTo = parseDateParam(searchParams.get("to"));
  const granularityParam = searchParams.get("granularity");
  const granularity: FlowGranularity = granularityParam === "day" || granularityParam === "week" ? granularityParam : "month";
  const from = requestedFrom ? startOfDay(requestedFrom) : new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  const to = requestedTo ? endOfDay(requestedTo) : new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  const next15Days = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

  const [
    filteredPayments,
    paymentsByPeriod,
    upcomingDue,
    pantryLowStock,
    pantryExpiring,
  ] = await Promise.all([
    // Date filter pushed to DB: paymentDate if set, else registeredAt
    prisma.payment.findMany({
      where: {
        OR: [
          { paymentDate: { gte: from, lte: to } },
          { paymentDate: null, registeredAt: { gte: from, lte: to } },
        ],
      },
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
  ]);

  const paidPayments = filteredPayments.filter((p) => p.status === "PAID");
  const totalPayments = filteredPayments.length;
  const pendingPayments = filteredPayments.filter((p) => p.status === "PENDING").length;
  const overduePayments = filteredPayments.filter((p) => p.status === "OVERDUE").length;
  const recentPayments = [...filteredPayments]
    .sort((a, b) => (b.paymentDate ?? b.registeredAt).getTime() - (a.paymentDate ?? a.registeredAt).getTime())
    .slice(0, 5);

  const categoryAgg = new Map<string, { amount: number; count: number; color: string; received: boolean }>();
  const methodAgg = new Map<string, { amount: number; count: number }>();
  const flowAgg = buildFlowAgg(from, to, granularity);

  let paidTotal = 0;
  let receivedTotal = 0;
  let savingsTotal = 0;

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
    const key = flowKey(new Date(baseDate), from, granularity);
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
  } catch (error) {
    console.error("[dashboard GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
