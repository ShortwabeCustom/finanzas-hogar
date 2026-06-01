import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const payment = await prisma.personalPayment.findUnique({ where: { id } });
    if (!payment || payment.userId !== userId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    if (payment.status === "PAID") {
      return NextResponse.json({ error: "El pago ya está marcado como pagado" }, { status: 409 });
    }
    if (payment.status === "CANCELLED") {
      return NextResponse.json({ error: "No se puede marcar un pago cancelado" }, { status: 409 });
    }

    const updated = await prisma.personalPayment.update({
      where: { id },
      data: {
        status: "PAID",
        paymentDate: new Date(),
      },
      include: { category: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/payments/[id]/mark-paid]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
