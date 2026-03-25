import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    // userId is always sourced from the session — never from the request
    const userId = session.user.id;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalCount,
      pendingCount,
      overdueCount,
      paidThisMonth,
      byCategory,
      byMethod,
      upcoming,
      recent,
    ] = await Promise.all([
      prisma.personalPayment.count({ where: { userId } }),
      prisma.personalPayment.count({ where: { userId, status: "PENDING" } }),
      prisma.personalPayment.count({ where: { userId, status: "OVERDUE" } }),
      prisma.personalPayment.aggregate({
        where: { userId, status: "PAID", paymentDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.personalPayment.groupBy({
        by: ["categoryId"],
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.personalPayment.groupBy({
        by: ["paymentMethod"],
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.personalPayment.findMany({
        where: {
          userId,
          status: { in: ["PENDING", "OVERDUE"] },
          dueDate: { gte: now, lte: next7Days },
        },
        include: { category: true },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      prisma.personalPayment.findMany({
        where: { userId },
        include: { category: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    // Enrich byCategory with category details
    const categoryIds = byCategory.map((g) => g.categoryId);
    const categories = await prisma.personalCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true },
    });
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

    return NextResponse.json({
      totalCount,
      pendingCount,
      overdueCount,
      paidThisMonth: Number(paidThisMonth._sum.amount ?? 0),
      byCategory: byCategory.map((g) => ({
        name: catMap[g.categoryId]?.name ?? "Sin categoría",
        color: catMap[g.categoryId]?.color ?? "#6366f1",
        total: Number(g._sum.amount ?? 0),
        count: g._count,
      })),
      byMethod: byMethod.map((g) => ({
        method: g.paymentMethod,
        total: Number(g._sum.amount ?? 0),
        count: g._count,
      })),
      upcoming,
      recent,
    });
  } catch (error) {
    console.error("[personal/dashboard]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
