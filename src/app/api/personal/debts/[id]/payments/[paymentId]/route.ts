import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateDebtTotals,
  shouldMarkAsPaidOff,
  findNextDueDate,
} from "@/lib/financial/debt-calculations";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para editar pagos" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const paymentId = (await params).paymentId;

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    const payment = await prisma.debtPayment.findUnique({
      where: { id: paymentId },
      include: { personalPayment: true },
    });

    if (!payment || payment.debtId !== debtId) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const { principalAmount, interestAmount, feeAmount, penaltyAmount, paidAt, notes } = body;

    // Validar monto total
    const totalAmount =
      (principalAmount || 0) +
      (interestAmount || 0) +
      (feeAmount || 0) +
      (penaltyAmount || 0);

    if (totalAmount <= 0) {
      return NextResponse.json(
        { error: "El monto total debe ser mayor que cero" },
        { status: 400 }
      );
    }

    // Transacción: actualizar pagos y recalcular
    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar DebtPayment
      const updatedDebtPayment = await tx.debtPayment.update({
        where: { id: paymentId },
        data: {
          principalAmount: principalAmount || payment.principalAmount,
          interestAmount: interestAmount !== undefined ? interestAmount : payment.interestAmount,
          feeAmount: feeAmount !== undefined ? feeAmount : payment.feeAmount,
          penaltyAmount: penaltyAmount !== undefined ? penaltyAmount : payment.penaltyAmount,
          totalAmount,
          paidAt: paidAt ? new Date(paidAt) : payment.paidAt,
          notes: notes !== undefined ? notes : payment.notes,
        },
      });

      // 2. Actualizar PersonalPayment
      await tx.personalPayment.update({
        where: { id: payment.personalPaymentId },
        data: {
          amount: totalAmount,
          paymentDate: paidAt ? new Date(paidAt) : payment.personalPayment.paymentDate,
          notes: notes !== undefined ? notes : payment.personalPayment.notes,
        },
      });

      // 3. Recalcular cuota si existe
      if (payment.installmentId) {
        const installment = await tx.debtInstallment.findUnique({
          where: { id: payment.installmentId },
        });

        if (installment) {
          // Obtener todos los pagos para esta cuota excepto el actual
          const otherPayments = await tx.debtPayment.findMany({
            where: {
              installmentId: payment.installmentId,
              id: { not: paymentId },
            },
          });

          let newTotalPaid = (principalAmount || payment.principalAmount) || 0;
          for (const p of otherPayments) {
            newTotalPaid += Number(p.principalAmount);
          }

          const expectedAmount = Number(installment.expectedAmount);
          let newStatus: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" =
            "PENDING";
          if (newTotalPaid >= expectedAmount) {
            newStatus = "PAID";
          } else if (newTotalPaid > 0) {
            newStatus = "PARTIALLY_PAID";
          }

          await tx.debtInstallment.update({
            where: { id: payment.installmentId },
            data: {
              totalPaid: newTotalPaid,
              status: newStatus,
            },
          });
        }
      }

      // 4. Recalcular toda la deuda
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

      return updatedDebtPayment;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[personal/debts/[id]/payments/[paymentId] PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para eliminar pagos" }, { status: 403 });
    }

    const userId = session.user.id;
    const debtId = (await params).id;
    const paymentId = (await params).paymentId;

    // Verificar propiedad
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: "Deuda no encontrada" }, { status: 404 });
    }

    const payment = await prisma.debtPayment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.debtId !== debtId) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    // Transacción: eliminar pago y recalcular
    await prisma.$transaction(async (tx) => {
      // 1. Eliminar DebtPayment (PersonalPayment se elimina en cascada)
      await tx.debtPayment.delete({
        where: { id: paymentId },
      });

      // 2. Eliminar PersonalPayment
      await tx.personalPayment.delete({
        where: { id: payment.personalPaymentId },
      });

      // 3. Recalcular cuota si existe
      if (payment.installmentId) {
        const installment = await tx.debtInstallment.findUnique({
          where: { id: payment.installmentId },
        });

        if (installment) {
          const remainingPayments = await tx.debtPayment.findMany({
            where: { installmentId: payment.installmentId },
          });

          let newTotalPaid = 0;
          for (const p of remainingPayments) {
            newTotalPaid += Number(p.principalAmount);
          }

          const expectedAmount = Number(installment.expectedAmount);
          let newStatus: "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED" =
            "PENDING";
          if (newTotalPaid >= expectedAmount) {
            newStatus = "PAID";
          } else if (newTotalPaid > 0) {
            newStatus = "PARTIALLY_PAID";
          }

          await tx.debtInstallment.update({
            where: { id: payment.installmentId },
            data: {
              totalPaid: newTotalPaid,
              status: newStatus,
            },
          });
        }
      }

      // 4. Recalcular toda la deuda
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
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[personal/debts/[id]/payments/[paymentId] DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
