import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalCardSchema } from "@/lib/validations";

async function getOwnedCard(id: string, userId: string) {
  const card = await prisma.personalCard.findUnique({ where: { id } });
  // Return null for both "not found" and "not owned" — never reveal existence to other users
  if (!card || card.userId !== userId) return null;
  return card;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { id } = await params;
    const card = await getOwnedCard(id, session.user.id);
    if (!card) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json(card);
  } catch (error) {
    console.error("[personal/cards/[id] GET]", error);
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
    const card = await getOwnedCard(id, userId);
    if (!card) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json();
    const parsed = personalCardSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    // Check uniqueness excluding self
    const changed = parsed.data.bankName !== card.bankName
      || parsed.data.last4Digits !== card.last4Digits
      || parsed.data.paymentSourceType !== (card as any).paymentSourceType;
    if (changed) {
      const conflict = await prisma.personalCard.findUnique({
        where: {
          userId_bankName_last4Digits_paymentSourceType: {
            userId,
            bankName: parsed.data.bankName,
            last4Digits: parsed.data.last4Digits,
            paymentSourceType: parsed.data.paymentSourceType,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: `Ya tienes una ${parsed.data.paymentSourceType === "BANK_ACCOUNT" ? "cuenta" : "tarjeta"} de ${parsed.data.bankName} terminada en ${parsed.data.last4Digits}` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.personalCard.update({
      where: { id },
      data: parsed.data,
      include: { _count: { select: { payments: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/cards/[id] PATCH]", error);
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
    const card = await getOwnedCard(id, session.user.id);
    if (!card) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    // Nullify card reference on payments before deleting
    await prisma.personalPayment.updateMany({
      where: { personalCardId: id },
      data: { personalCardId: null },
    });

    await prisma.personalCard.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[personal/cards/[id] DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
