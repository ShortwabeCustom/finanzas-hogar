import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalCardSchema } from "@/lib/validations";

// Maps PaymentMethod → PaymentSourceType filter
const METHOD_TO_SOURCE: Record<string, string[]> = {
  CREDIT_CARD: ["CREDIT_CARD"],
  DEBIT_CARD: ["DEBIT_CARD"],
  TRANSFER: ["BANK_ACCOUNT", "DEBIT_CARD"],
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    // Any authenticated user can fetch another user's cards (needed for shared payment form)
    const targetUserId = searchParams.get("userId") ?? session.user.id;
    const activeOnly = searchParams.get("active") !== "false";
    const method = searchParams.get("method") ?? "";
    const sourceTypes = METHOD_TO_SOURCE[method];

    const cards = await prisma.personalCard.findMany({
      where: {
        userId: targetUserId,
        ...(activeOnly ? { active: true } : {}),
        ...(sourceTypes ? { paymentSourceType: { in: sourceTypes as any } } : {}),
      },
      include: { _count: { select: { payments: true } } },
      orderBy: [{ bankName: "asc" }, { cardName: "asc" }],
    });

    return NextResponse.json(cards);
  } catch (error) {
    console.error("[personal/cards GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const body = await req.json();
    const parsed = personalCardSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    // Check uniqueness: same bank + last4 + type per user
    const existing = await prisma.personalCard.findUnique({
      where: {
        userId_bankName_last4Digits_paymentSourceType: {
          userId,
          bankName: parsed.data.bankName,
          last4Digits: parsed.data.last4Digits,
          paymentSourceType: parsed.data.paymentSourceType,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Ya tienes una ${parsed.data.paymentSourceType === "BANK_ACCOUNT" ? "cuenta" : "tarjeta"} de ${parsed.data.bankName} terminada en ${parsed.data.last4Digits}` },
        { status: 409 }
      );
    }

    const card = await prisma.personalCard.create({
      data: { ...parsed.data, userId },
      include: { _count: { select: { payments: true } } },
    });

    return NextResponse.json(card, { status: 201 });
  } catch (error) {
    console.error("[personal/cards POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
