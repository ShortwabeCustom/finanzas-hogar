import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalPaymentSchema } from "@/lib/validations";
import { generateFolio } from "@/lib/utils";

const CARD_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"];

async function resolveCardId(
  personalCardId: string | null | undefined,
  paymentMethod: string,
  userId: string
): Promise<{ cardId: string | null; error?: string }> {
  if (!personalCardId || !CARD_METHODS.includes(paymentMethod)) {
    return { cardId: null };
  }
  // Verify the card belongs to this user
  const card = await prisma.personalCard.findUnique({ where: { id: personalCardId } });
  if (!card || card.userId !== userId || !card.active) {
    return { cardId: null, error: "Tarjeta inválida o no pertenece al usuario" };
  }
  return { cardId: personalCardId };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const categoryId = searchParams.get("categoryId") ?? "";
    const status = searchParams.get("status") ?? "";
    const paymentMethod = searchParams.get("paymentMethod") ?? "";
    const cardId = searchParams.get("cardId") ?? "";

    // userId is always sourced from the session — never from the client
    const where: any = { userId };
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
    if (cardId) where.personalCardId = cardId;

    const payments = await prisma.personalPayment.findMany({
      where,
      include: { category: true, card: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("[personal/payments GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
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

    const folio = generateFolio("PER");
    const payment = await prisma.personalPayment.create({
      data: {
        userId,
        folio,
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
      },
      include: { category: true, card: true },
    });

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error("[personal/payments POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
