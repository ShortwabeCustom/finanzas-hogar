import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations";
import { generateFolio } from "@/lib/utils";

// Methods that require a PersonalCard association
const CARD_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"];

// Maps PaymentMethod → expected PaymentSourceType
const METHOD_TO_SOURCE: Record<string, string> = {
  CREDIT_CARD: "CREDIT_CARD",
  DEBIT_CARD: "DEBIT_CARD",
  TRANSFER: "BANK_ACCOUNT",
};

async function validatePersonalCard(
  personalCardId: string | null | undefined,
  paymentMethod: string,
  paidById: string | null | undefined
): Promise<{ resolvedCardId: string | null; error?: string }> {
  // If method doesn't support cards, ignore and clear any supplied id
  if (!CARD_METHODS.includes(paymentMethod) || !personalCardId) {
    return { resolvedCardId: null };
  }
  const card = await prisma.personalCard.findUnique({ where: { id: personalCardId } });
  if (!card || !card.active) {
    return { resolvedCardId: null, error: "El medio de pago seleccionado no existe o está inactivo" };
  }
  // Card must belong to the paidBy user
  if (paidById && card.userId !== paidById) {
    return { resolvedCardId: null, error: "El medio de pago no pertenece al usuario seleccionado en 'Pagado por'" };
  }
  // Type must match payment method
  const expectedType = METHOD_TO_SOURCE[paymentMethod];
  if ((card as any).paymentSourceType !== expectedType) {
    return { resolvedCardId: null, error: "El tipo de medio de pago no es compatible con la forma de pago seleccionada" };
  }
  return { resolvedCardId: personalCardId };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const status = searchParams.get("status") ?? "";
  const paymentMethod = searchParams.get("paymentMethod") ?? "";
  const paidById = searchParams.get("paidById") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { concept: { contains: search, mode: "insensitive" } },
      { folio: { contains: search, mode: "insensitive" } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (paymentMethod) where.paymentMethod = paymentMethod;
  if (paidById) where.paidById = paidById;
  if (from || to) {
    where.registeredAt = {};
    if (from) where.registeredAt.gte = new Date(from);
    if (to) where.registeredAt.lte = new Date(to);
  }

  const payments = await prisma.payment.findMany({
    where,
    include: { category: true, paidBy: { select: { id: true, name: true, email: true } }, card: true },
    orderBy: { registeredAt: "desc" },
  });

  return NextResponse.json(payments);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;

    // Validate card ownership and type compatibility
    const { resolvedCardId, error: cardError } = await validatePersonalCard(
      data.personalCardId,
      data.paymentMethod,
      data.paidById
    );
    if (cardError) return NextResponse.json({ error: cardError }, { status: 400 });

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
        personalCardId: resolvedCardId,
        receipt: data.receipt ?? null,
        comments: data.comments ?? null,
      },
      include: { category: true, paidBy: { select: { id: true, name: true, email: true } }, card: true },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("[payments POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
