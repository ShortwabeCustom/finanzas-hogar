import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const account = await prisma.bankAccount.findFirst({ where: { id, userId } });
    if (!account) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const body = await req.json();
    const { bankName, productName, cardNumber, type } = body as {
      bankName?: string;
      productName?: string;
      cardNumber?: string | null;
      type?: "CHECKING" | "CREDIT";
    };

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...(bankName !== undefined && { bankName: bankName.trim() }),
        ...(productName !== undefined && { productName: productName.trim() }),
        ...(cardNumber !== undefined && { cardNumber: cardNumber?.trim() || null }),
        ...(type !== undefined && { type }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/accounts PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
