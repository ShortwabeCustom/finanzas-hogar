import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { linkTransactionSchema } from "@/lib/validations/debt";
import { generateFolio } from "@/lib/utils";
import {
  calculateDebtTotals,
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para vincular transacciones" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const body = await req.json();

    // Validar datos
    const parsed = linkTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const bankTransactionId = body.bankTransactionId;

    if (!bankTransactionId) {
      return NextResponse.json({ error: "Transacción bancaria requerida" }, { status: 400 });
    }

    // Verificar propiedad de la deuda
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      include: { payments: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    // Verificar transacción bancaria
    const bankTransaction = await prisma.bankTransaction.findUnique({
      where: { id: bankTransactionId },
      include: { account: true, personalPayment: true },
    });

    if (!bankTransaction || bankTransaction.account.userId !== userId) {
      return NextResponse.json({ error: "Transacción bancaria no encontrada" }, { status: 404 });
    }

    // Verificar que no esté ya vinculada a otra deuda
    if (bankTransaction.personalPayment) {
      const existingDebtPayment = await prisma.debtPayment.findUnique({
        where: { personalPaymentId: bankTransaction.personalPayment.id },
      });
      if (existingDebtPayment && existingDebtPayment.debtId !== debtId) {
        return NextResponse.json(
          { error: "Esta transacción ya está vinculada a otra deuda" },
          { status: 409 }
        );
      }
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
    if (new Prisma.Decimal(data.principalAmount).greaterThan(totals.currentBalance)) {
      return NextResponse.json(
        { error: "El capital no puede superar el saldo pendiente" },
        { status: 400 }
      );
    }

    const totalAmount =
      Number(data.principalAmount) +
      Number(data.interestAmount || 0) +
      Number(data.feeAmount || 0) +
      Number(data.penaltyAmount || 0);

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "El monto total debe ser mayor que cero" },
        { status: 400 }
      );
    }

    // Obtener categoría
    const category = await findCategoryForTransfer(userId);

    // Transacción: crear o actualizar PersonalPayment + crear DebtPayment + actualizar deuda
    const result = await prisma.$transaction(async (tx) => {
      let personalPayment;

      if (bankTransaction.personalPayment) {
        // Actualizar PersonalPayment existente
        personalPayment = await tx.personalPayment.update({
          where: { id: bankTransaction.personalPayment.id },
          data: {
            amount: totalAmount,
            type: "DEBT_PAYMENT",
            financialClass: "TRANSFER",
            notes: data.notes || bankTransaction.personalPayment.notes,
          },
        });
      } else {
        // Crear nuevo PersonalPayment
        personalPayment = await tx.personalPayment.create({
          data: {
            userId,
            folio: generateFolio("DEBT"),
            name: `Pago: ${debt.name}`,
            concept: `Pago de ${debt.direction === "PAYABLE" ? "deuda" : "préstamo"}`,
            amount: totalAmount,
            categoryId: category.id,
            personalCardId: null,
            status: "PAID",
            paymentMethod: "TRANSFER",
            paymentDate: new Date(bankTransaction.transactionDate),
            dueDate: null,
            notes: null,
            receipt: null,
            type: "DEBT_PAYMENT",
            financialClass: "TRANSFER",
            bankTransactionId: bankTransactionId,
            importedFromBank: true,
          },
        });
      }

      // Crear DebtPayment
      const debtPayment = await tx.debtPayment.create({
        data: {
          debtId,
          installmentId: data.installmentId || null,
          personalPaymentId: personalPayment.id,
          paidAt: new Date(bankTransaction.transactionDate),
          principalAmount: data.principalAmount,
          interestAmount: data.interestAmount || 0,
          feeAmount: data.feeAmount || 0,
          penaltyAmount: data.penaltyAmount || 0,
          totalAmount,
        },
      });

      // Actualizar installment si aplica
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

      // Recalcular deuda
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

      await tx.debtAccount.update({
        where: { id: debtId },
        data: {
          currentPrincipal: allTotals.currentBalance.toNumber(),
          nextDueDate,
          status: isPaidOff ? "PAID_OFF" : "ACTIVE",
        },
      });

      return debtPayment;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[personal/debts/[id]/link-transaction POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
