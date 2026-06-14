import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCreditCardCalendar } from "@/lib/financial/credit-card-calendar";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const months = Math.min(12, Math.max(1, parseInt(searchParams.get("months") ?? "3", 10) || 3));

    const cards = await prisma.personalCard.findMany({
      where: { userId, active: true, paymentSourceType: "CREDIT_CARD" },
      orderBy: [{ bankName: "asc" }, { cardName: "asc" }],
    });

    const result = buildCreditCardCalendar(
      cards.map(c => ({
        id:           c.id,
        bankName:     c.bankName,
        cardName:     c.cardName,
        last4Digits:  c.last4Digits,
        closingDay:   c.closingDay,
        dueDay:       c.dueDay,
      })),
      { months }
    );

    // Strip internal IDs from cards before sending to client
    const safeCards = result.cards.map(({ id: _id, ...rest }) => rest);

    return NextResponse.json({
      today:           result.today,
      alerts:          result.alerts,
      recommendations: result.recommendations,
      calendar:        result.calendar,
      cards:           safeCards,
      emptyState:      result.emptyState ?? false,
    });
  } catch (error) {
    console.error("[personal/cards/calendar GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
