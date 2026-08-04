import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtPaymentSchema } from "@/lib/validations/debt";
import { generateFolio } from "@/lib/utils";
import {
  calculateDebtTotals,
  validateDebtPayment,
  shouldMarkAsPaidOff,
  findNextDueDate,
} from "@/lib/financial/debt-calculations";
import { Prisma } from "@prisma/client";

async function findCategoryForTransfer(userId: string) {
  let category = await prisma.personalCategory.findFirst({
    where: { userId, name: { contains: "Transferencia", mode: "insensitive" } },
  });

  if (!category) {
    category = await prisma.personalCategory.create({
      data: {
        userId,
        name: "Transferencia",
        description: "Transferencias y movimientos de deuda",
        color: "#f59e0b",
        type: "PAYMENT",
      },
    });
  }

  return category;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const debtId = (await params).id;

    // Verificar propiedad de la deuda
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    const payments = await prisma.debtPayment.findMany({
      where: { debtId },
      include: { personalPayment: true, installment: true },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error("[personal/debts/[id]/payments GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
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
      return NextResponse.json({ error: "No tienes permisos para registrar pagos" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const body = await req.json();

    // Validar datos
    const parsed = debtPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Verificar propiedad de la deuda
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      include: { payments: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    // Validar cuota si se proporciona
    if (data.installmentId) {
      const installment = await prisma.debtInstallment.findUnique({
        where: { id: data.installmentId },
      });
      if (!installment || installment.debtId !== debtId) {
        return NextResponse.json({ error: "Cuota inválida" }, { status: 400 });
      }
    }

    // Calcular saldo actual
    const totals = calculateDebtTotals(
      new Prisma.Decimal(debt.originalPrincipal),
      debt.payments
    );

    // Validar desglose
    const validation = validateDebtPayment(
      new Prisma.Decimal(data.principalAmount),
      new Prisma.Decimal(data.interestAmount),
      new Prisma.Decimal(data.feeAmount),
      new Prisma.Decimal(data.penaltyAmount),
      totals.currentBalance
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Verificar tarjeta si se proporciona
    let cardId: string | null = null;
    if (data.personalCardId) {
      const card = await prisma.personalCard.findUnique({
        where: { id: data.personalCardId },
      });
      if (!card || card.userId !== userId || !card.active) {
        return NextResponse.json({ error: "Tarjeta inválida" }, { status: 400 });
      }
      cardId = data.personalCardId;
    }

    // Obtener categoría para el pago
    const category = await findCategoryForTransfer(userId);

    // Transacción: crear PersonalPayment + DebtPayment + actualizar deuda
    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear PersonalPayment
      const totalAmount =
        Number(data.principalAmount) +
        Number(data.interestAmount) +
        Number(data.feeAmount) +
        Number(data.penaltyAmount);

      const personalPayment = await tx.personalPayment.create({
        data: {
          userId,
          folio: generateFolio("DEBT"),
          name: `Pago: ${debt.name}`,
          concept: `Pago de ${debt.direction === "PAYABLE" ? "deuda" : "préstamo"}`,
          amount: totalAmount,
          categoryId: category.id,
          personalCardId: cardId,
          status: "PAID",
          paymentMethod: data.paymentMethod,
          paymentDate: new Date(data.paidAt),
          dueDate: null,
          notes: data.notes || null,
          receipt: null,
          type: "DEBT_PAYMENT",
          financialClass: "TRANSFER",
          importedFromBank: false,
        },
      });

      // 2. Crear DebtPayment
      const debtPayment = await tx.debtPayment.create({
        data: {
          debtId,
          installmentId: data.installmentId || null,
          personalPaymentId: personalPayment.id,
          paidAt: new Date(data.paidAt),
          principalAmount: data.principalAmount,
          interestAmount: data.interestAmount || 0,
          feeAmount: data.feeAmount || 0,
          penaltyAmount: data.penaltyAmount || 0,
          totalAmount: totalAmount,
          notes: data.notes || null,
        },
      });

      // 3. Actualizar installment si aplica
      if (data.installmentId) {
        const installment = await tx.debtInstallment.findUnique({
          where: { id: data.installmentId },
        });

        if (installment) {
          const newTotalPaid = Number(installment.totalPaid) + data.principalAmount;
          const expectedAmount = Number(installment.expectedAmount);

          let newStatus: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" =
            "PENDING";
          if (newTotalPaid >= expectedAmount) {
            newStatus = "PAID";
          } else if (newTotalPaid > 0) {
            newStatus = "PARTIALLY_PAID";
          }

          await tx.debtInstallment.update({
            where: { id: data.installmentId },
            data: {
              totalPaid: newTotalPaid,
              status: newStatus,
            },
          });
        }
      }

      // 4. Recalcular deuda
      const allPayments = await tx.debtPayment.findMany({
        where: { debtId },
      });

      const allTotals = calculateDebtTotals(
        new Prisma.Decimal(debt.originalPrincipal),
        allPayments
      );

      const isPaidOff = shouldMarkAsPaidOff(allTotals.currentBalance);
      const allInstallments = await tx.debtInstallment.findMany({
        where: { debtId },
      });

      const nextDueDate = isPaidOff ? null : findNextDueDate(allInstallments);

      const updatedDebt = await tx.debtAccount.update({
        where: { id: debtId },
        data: {
          currentPrincipal: allTotals.currentBalance.toNumber(),
          nextDueDate,
          status: isPaidOff ? "PAID_OFF" : "ACTIVE",
          updatedAt: new Date(),
        },
        include: {
          personalCard: true,
          installments: { orderBy: { sequence: "asc" } },
          payments: { orderBy: { paidAt: "desc" } },
        },
      });

      return { debtPayment, updatedDebt };
    });

    return NextResponse.json(result.debtPayment, { status: 201 });
  } catch (error) {
    console.error("[personal/debts/[id]/payments POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
