import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalPaymentSchema } from "@/lib/validations";

const CARD_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"];

async function resolveCardId(
  personalCardId: string | null | undefined,
  paymentMethod: string,
  userId: string
): Promise<{ cardId: string | null; error?: string }> {
  if (!personalCardId || !CARD_METHODS.includes(paymentMethod)) {
    return { cardId: null };
  }
  const card = await prisma.personalCard.findUnique({ where: { id: personalCardId } });
  if (!card || card.userId !== userId || !card.active) {
    return { cardId: null, error: "Tarjeta inválida o no pertenece al usuario" };
  }
  return { cardId: personalCardId };
}

async function getOwnedPayment(id: string, userId: string) {
  const payment = await prisma.personalPayment.findUnique({ where: { id } });
  if (!payment || payment.userId !== userId) return null;
  return payment;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const payment = await getOwnedPayment(id, session.user.id);
    if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json(payment);
  } catch (error) {
    console.error("[personal/payments/[id] GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const userId = session.user.id;
    const payment = await getOwnedPayment(id, userId);
    if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json();
    const parsed = personalPaymentSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    // Verify category ownership
    const category = await prisma.personalCategory.findUnique({ where: { id: parsed.data.categoryId } });
    if (!category || category.userId !== userId) {
      return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
    }

    // Verify card ownership (if provided)
    const { cardId, error: cardError } = await resolveCardId(
      parsed.data.personalCardId,
      parsed.data.paymentMethod,
      userId
    );
    if (cardError) return NextResponse.json({ error: cardError }, { status: 400 });

    const updated = await prisma.personalPayment.update({
      where: { id },
      data: {
        name: parsed.data.name,
        concept: parsed.data.concept,
        amount: parsed.data.amount,
        categoryId: parsed.data.categoryId,
        personalCardId: cardId,
        period: parsed.data.period,
        status: parsed.data.status,
        paymentMethod: parsed.data.paymentMethod,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        paymentDate: parsed.data.paymentDate ? new Date(parsed.data.paymentDate) : null,
        notes: parsed.data.notes ?? null,
        receipt: parsed.data.receipt ?? null,
      },
      include: { category: true, card: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/payments/[id] PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const payment = await getOwnedPayment(id, session.user.id);
    if (!payment) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Check if payment is linked to a debt
    const debtPayment = await prisma.debtPayment.findUnique({
      where: { personalPaymentId: id },
    });

    if (debtPayment) {
      return NextResponse.json(
        {
          error:
            "Este pago está vinculado a una deuda. Elimínalo desde el historial de la deuda para recalcular el saldo correctamente.",
        },
        { status: 409 }
      );
    }

    await prisma.personalPayment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[personal/payments/[id] DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
