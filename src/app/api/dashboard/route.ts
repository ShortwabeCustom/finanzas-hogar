import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalPayments,
    pendingPayments,
    overduePayments,
    paidThisMonth,
    paymentsByCategory,
    paymentsByMethod,
    paymentsByPeriod,
    upcomingDue,
    pantryLowStock,
    pantryExpiring,
    recentPayments,
  ] = await Promise.all([
    // Total de pagos
    prisma.payment.count(),
    // Pendientes
    prisma.payment.count({ where: { status: "PENDING" } }),
    // Vencidos
    prisma.payment.count({ where: { status: "OVERDUE" } }),
    // Pagado este mes
    prisma.payment.aggregate({
      where: { status: "PAID", paymentDate: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    }),
    // Por categoría
    prisma.payment.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      _count: true,
    }),
    // Por forma de pago
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      _sum: { amount: true },
      _count: true,
    }),
    // Por periodo
    prisma.payment.groupBy({
      by: ["period"],
      _sum: { amount: true },
      _count: true,
    }),
    // Próximos vencimientos (7 días)
    prisma.payment.findMany({
      where: { status: "PENDING", dueDate: { gte: now, lte: next7Days } },
      include: { category: true },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    // Despensa: stock bajo
    prisma.pantryItem.findMany({
      where: { active: true },
      include: { category: true },
    }).then((items) => items.filter((i) => Number(i.quantity) <= Number(i.minStock))),
    // Despensa: por vencer
    prisma.pantryItem.findMany({
      where: { active: true, expiryDate: { lte: next7Days, gte: now } },
      include: { category: true },
    }),
    // Últimos pagos
    prisma.payment.findMany({
      take: 5,
      orderBy: { registeredAt: "desc" },
      include: { category: true, paidBy: { select: { name: true } } },
    }),
  ]);

  // Enriquecer paymentsByCategory con nombres
  const categoryIds = paymentsByCategory.map((p) => p.categoryId);
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  return NextResponse.json({
    summary: {
      totalPayments,
      pendingPayments,
      overduePayments,
      paidThisMonth: Number(paidThisMonth._sum.amount ?? 0),
    },
    paymentsByCategory: paymentsByCategory.map((p) => ({
      category: categoryMap[p.categoryId]?.name ?? "Sin categoría",
      color: categoryMap[p.categoryId]?.color ?? "#6366f1",
      amount: Number(p._sum.amount ?? 0),
      count: p._count,
    })),
    paymentsByMethod,
    paymentsByPeriod,
    upcomingDue,
    pantryAlerts: {
      lowStock: pantryLowStock,
      expiring: pantryExpiring,
    },
    recentPayments,
  });
}
