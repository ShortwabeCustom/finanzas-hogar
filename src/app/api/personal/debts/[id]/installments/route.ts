import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const debtId = (await params).id;

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    const installments = await prisma.debtInstallment.findMany({
      where: { debtId },
      include: { payments: true },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json(installments);
  } catch (error) {
    console.error("[personal/debts/[id]/installments GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
