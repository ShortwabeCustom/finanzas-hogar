import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/financial/transactions/[id]
 * Updates editable fields on a BankTransaction owned by the session user.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { id } = await params;
    const userId = session.user.id;

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, account: { userId } },
    });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json();
    const { transactionDate, description, reference, chargeAmount, creditAmount, balance } = body as {
      transactionDate?: string;
      description?: string;
      reference?: string | null;
      chargeAmount?: number | null;
      creditAmount?: number | null;
      balance?: number | null;
    };

    const updated = await prisma.bankTransaction.update({
      where: { id },
      data: {
        ...(transactionDate !== undefined && { transactionDate: new Date(transactionDate + "T12:00:00") }),
        ...(description !== undefined && { description: description.trim() }),
        ...(reference !== undefined && { reference: reference?.trim() || null }),
        ...(chargeAmount !== undefined && { chargeAmount: chargeAmount ?? null }),
        ...(creditAmount !== undefined && { creditAmount: creditAmount ?? null }),
        ...(balance !== undefined && { balance: balance ?? null }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[financial/transactions PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/financial/transactions/[id]
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { id } = await params;
    const userId = session.user.id;

    const existing = await prisma.bankTransaction.findFirst({
      where: { id, account: { userId } },
    });
    if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    await prisma.bankTransaction.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[financial/transactions DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
