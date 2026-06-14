import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/accounts/[id]
 * Edits a HOUSEHOLD BankAccount: bankName, productName, cardNumber, type.
 * VIEWER cannot edit.
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
    const body = await req.json();
    const { bankName, productName, cardNumber, type } = body as {
      bankName?: string;
      productName?: string;
      cardNumber?: string | null;
      type?: "CHECKING" | "CREDIT";
    };

    const account = await prisma.bankAccount.findFirst({
      where: { id, scope: "HOUSEHOLD" },
      select: { id: true },
    });

    if (!account) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(bankName !== undefined && { bankName }),
        ...(productName !== undefined && { productName }),
        ...(cardNumber !== undefined && { cardNumber: cardNumber || null }),
        ...(type !== undefined && { type }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[accounts PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
