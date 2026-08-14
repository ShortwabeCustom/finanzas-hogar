import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations";

const CARD_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"];
const METHOD_TO_ALLOWED_SOURCES: Record<string, string[]> = {
  CREDIT_CARD: ["CREDIT_CARD"],
  DEBIT_CARD: ["DEBIT_CARD"],
  TRANSFER: ["BANK_ACCOUNT", "DEBIT_CARD"],
};

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function validatePersonalCard(
  personalCardId: string | null | undefined,
  paymentMethod: string,
  paidById: string | null | undefined
): Promise<{ resolvedCardId: string | null; error?: string }> {
  if (!CARD_METHODS.includes(paymentMethod) || !personalCardId) {
    return { resolvedCardId: null };
  }
  const card = await prisma.personalCard.findUnique({ where: { id: personalCardId } });
  if (!card || !card.active) {
    return { resolvedCardId: null, error: "El medio de pago seleccionado no existe o está inactivo" };
  }
  if (paidById && card.userId !== paidById) {
    return { resolvedCardId: null, error: "El medio de pago no pertenece al usuario seleccionado en 'Pagado por'" };
  }
  const allowedTypes = METHOD_TO_ALLOWED_SOURCES[paymentMethod] ?? [];
  if (!allowedTypes.includes((card as any).paymentSourceType)) {
    return { resolvedCardId: null, error: "El tipo de medio de pago no es compatible con la forma de pago seleccionada" };
  }
  return { resolvedCardId: personalCardId };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { category: true, createdBy: { select: { id: true, name: true, email: true } }, paidBy: { select: { id: true, name: true, email: true } }, card: true },
  });
  if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(payment);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const parsed = paymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const data = parsed.data;

    const normalizedPaidById = normalizeOptionalId(data.paidById);
    const { resolvedCardId, error: cardError } = await validatePersonalCard(
      data.personalCardId,
      data.paymentMethod,
      normalizedPaidById
    );
    if (cardError) return NextResponse.json({ error: cardError }, { status: 400 });

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        name: data.name,
        concept: data.concept,
        categoryId: data.categoryId,
        amount: data.amount,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        period: data.period,
        status: data.status,
        paymentMethod: data.paymentMethod,
        paidById: normalizedPaidById,
        personalCardId: resolvedCardId,
        receipt: data.receipt ?? null,
        comments: data.comments ?? null,
      },
      include: { category: true, createdBy: { select: { id: true, name: true, email: true } }, paidBy: { select: { id: true, name: true, email: true } }, card: true },
    });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("[payments/[id] PUT]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "EDITOR") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
