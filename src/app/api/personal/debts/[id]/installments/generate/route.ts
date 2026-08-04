import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInstallmentsSchema } from "@/lib/validations/debt";
import { addDays, addWeeks, addMonths, addQuarters } from "date-fns";
import { Prisma } from "@prisma/client";

function addPeriod(date: Date, period: string, count: number = 1): Date {
  switch (period) {
    case "WEEKLY":
      return addWeeks(date, count);
    case "BIWEEKLY":
      return addWeeks(date, count * 2);
    case "MONTHLY":
      return addMonths(date, count);
    case "BIMONTHLY":
      return addMonths(date, count * 2);
    case "QUARTERLY":
      return addQuarters(date, count);
    case "SEMIANNUAL":
      return addMonths(date, count * 6);
    case "ANNUAL":
      return addMonths(date, count * 12);
    case "ONCE":
    default:
      return date;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para generar cuotas" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const body = await req.json();

    // Validar datos
    const parsed = generateInstallmentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      include: { installments: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    // No permitir sobrescribir cuotas existentes
    if (debt.installments.length > 0) {
      return NextResponse.json(
        { error: "Esta deuda ya tiene cuotas generadas" },
        { status: 409 }
      );
    }

    // Calcular monto de cada cuota
    const totalPrincipal = new Prisma.Decimal(debt.currentPrincipal);
    const monthlyPaymentAmount = totalPrincipal.dividedBy(data.numberOfInstallments);

    const installments = [];
    let currentDate = new Date(data.firstPaymentDate);

    for (let i = 1; i <= data.numberOfInstallments; i++) {
      installments.push({
        debtId,
        sequence: i,
        dueDate: currentDate,
        expectedAmount: monthlyPaymentAmount.toNumber(),
        expectedPrincipal: monthlyPaymentAmount.toNumber(),
        expectedInterest: null as any,
        expectedFees: null as any,
        totalPaid: 0,
        status: "PENDING" as const,
        isEstimated: true,
      });

      currentDate = addPeriod(currentDate, data.paymentFrequency);
    }

    // Crear todas las cuotas
    const created = await prisma.debtInstallment.createMany({
      data: installments,
    });

    // Actualizar deuda con próxima fecha de vencimiento
    const firstInstallment = new Date(data.firstPaymentDate);
    await prisma.debtAccount.update({
      where: { id: debtId },
      data: {
        nextDueDate: firstInstallment,
        numberOfInstallments: data.numberOfInstallments,
        paymentFrequency: data.paymentFrequency,
      },
    });

    // Retornar las cuotas creadas
    const created_installments = await prisma.debtInstallment.findMany({
      where: { debtId },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json(created_installments, { status: 201 });
  } catch (error) {
    console.error("[personal/debts/[id]/installments/generate POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
