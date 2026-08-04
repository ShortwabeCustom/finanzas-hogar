import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtFormSchema } from "@/lib/validations/debt";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const debtId = (await params).id;

    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      include: {
        personalCard: true,
        installments: { orderBy: { sequence: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    return NextResponse.json(debt);
  } catch (error) {
    console.error("[personal/debts/[id] GET]", error);
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

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para editar deudas" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const body = await req.json();

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({ where: { id: debtId } });
    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    // Validar datos
    const parsed = debtFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Verificar tarjeta si se proporciona
    if (data.personalCardId) {
      const card = await prisma.personalCard.findUnique({
        where: { id: data.personalCardId },
      });
      if (!card || card.userId !== userId || !card.active) {
        return NextResponse.json({ error: "Tarjeta inválida" }, { status: 400 });
      }
    }

    const updated = await prisma.debtAccount.update({
      where: { id: debtId },
      data: {
        direction: data.direction,
        type: data.type,
        name: data.name,
        counterpartyName: data.counterpartyName || null,
        originalPrincipal: data.originalPrincipal,
        currentPrincipal: data.currentPrincipal,
        annualInterestRate: data.annualInterestRate || null,
        scheduleMode: data.scheduleMode,
        paymentFrequency: data.paymentFrequency || null,
        scheduledPayment: data.scheduledPayment || null,
        numberOfInstallments: data.numberOfInstallments || null,
        startDate: new Date(data.startDate),
        estimatedEndDate: data.estimatedEndDate ? new Date(data.estimatedEndDate) : null,
        personalCardId: data.personalCardId || null,
        notes: data.notes || null,
        agreementUrl: data.agreementUrl || null,
      },
      include: {
        personalCard: true,
        installments: { orderBy: { sequence: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/debts/[id] PATCH]", error);
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

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para eliminar deudas" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      include: { payments: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    // No permitir eliminación si tiene pagos
    if (debt.payments.length > 0) {
      return NextResponse.json(
        { error: "No puedes eliminar una deuda con pagos registrados" },
        { status: 409 }
      );
    }

    await prisma.debtAccount.delete({ where: { id: debtId } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[personal/debts/[id] DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
