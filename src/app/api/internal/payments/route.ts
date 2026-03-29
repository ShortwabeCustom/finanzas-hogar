import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations";
import { generateFolio } from "@/lib/utils";
import { validateInternalToken } from "@/lib/internalAuth";

/**
 * Internal API endpoint for n8n automation.
 * Auth: x-internal-token header (no NextAuth session required).
 *
 * GET  /api/internal/payments?from=&to=&name=  → list for dedup check
 * POST /api/internal/payments                  → create new payment
 */

export async function GET(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const name = searchParams.get("name") ?? "";

  const where: any = {};

  if (from || to) {
    where.registeredAt = {};
    if (from) where.registeredAt.gte = new Date(from);
    if (to) where.registeredAt.lte = new Date(to);
  }

  if (name) {
    where.name = { contains: name, mode: "insensitive" };
  }

  const payments = await prisma.payment.findMany({
    where,
    select: {
      id: true,
      folio: true,
      name: true,
      amount: true,
      paymentDate: true,
      registeredAt: true,
      status: true,
      paymentMethod: true,
      paidBy: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: { registeredAt: "desc" },
    take: 100,
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    // paymentSchema expects the same shape as the UI form
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify categoryId exists
    const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!category) {
      return NextResponse.json(
        { error: `Categoría no encontrada: ${data.categoryId}` },
        { status: 400 }
      );
    }

    // Verify paidById exists if provided
    if (data.paidById) {
      const user = await prisma.user.findUnique({ where: { id: data.paidById } });
      if (!user) {
        return NextResponse.json(
          { error: `Usuario no encontrado: ${data.paidById}` },
          { status: 400 }
        );
      }
    }

    const folio = generateFolio("PAG");
    const payment = await prisma.payment.create({
      data: {
        folio,
        name: data.name,
        concept: data.concept,
        categoryId: data.categoryId,
        amount: data.amount,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        period: data.period,
        status: data.status,
        paymentMethod: data.paymentMethod,
        paidById: data.paidById ?? null,
        personalCardId: null,
        receipt: data.receipt ?? null,
        comments: data.comments ?? null,
      },
      include: {
        category: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("[internal/payments POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
