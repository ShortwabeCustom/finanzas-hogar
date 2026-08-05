import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateDebtTotals } from "@/lib/financial/debt-calculations";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;

    // Obtener todas las deudas y pagos
    const debts = await prisma.debtAccount.findMany({
      where: { userId },
      include: { payments: true },
    });

    let payableBalance = new Prisma.Decimal(0);
    let receivableBalance = new Prisma.Decimal(0);
    let estimatedMonthlyCommitment = new Prisma.Decimal(0);
    let nextDue: Date | null = null;
    let overdueInstallments = 0;
    let principalPaidCurrentYear = new Prisma.Decimal(0);

    const now = new Date();
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    for (const debt of debts) {
      if (debt.status === "PAID_OFF" || debt.status === "CANCELLED") continue;

      const totals = calculateDebtTotals(new Prisma.Decimal(debt.originalPrincipal), debt.payments);
      const balance = new Prisma.Decimal(debt.currentPrincipal);

      if (debt.direction === "PAYABLE") {
        payableBalance = payableBalance.plus(balance);
        if (debt.scheduledPayment) {
          estimatedMonthlyCommitment = estimatedMonthlyCommitment.plus(new Prisma.Decimal(debt.scheduledPayment));
        }
      } else {
        receivableBalance = receivableBalance.plus(balance);
      }

      // Próximo vencimiento
      if (debt.nextDueDate) {
        if (!nextDue || new Date(debt.nextDueDate) < nextDue) {
          nextDue = new Date(debt.nextDueDate);
        }
      }

      // Cuotas vencidas
      if (debt.scheduleMode === "INSTALLMENTS") {
        const overdueQuotas = await prisma.debtInstallment.count({
          where: {
            debtId: debt.id,
            dueDate: { lt: now },
            status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
          },
        });
        overdueInstallments += overdueQuotas;
      }

      // Capital pagado este año
      const yearPayments = debt.payments.filter(
        (p) => new Date(p.paidAt) >= yearStart && new Date(p.paidAt) <= now
      );
      for (const payment of yearPayments) {
        principalPaidCurrentYear = principalPaidCurrentYear.plus(
          new Prisma.Decimal(payment.principalAmount)
        );
      }
    }

    return NextResponse.json({
      totalPayable: payableBalance.toNumber(),
      totalReceivable: receivableBalance.toNumber(),
      estimatedMonthlyPayment: estimatedMonthlyCommitment.toNumber(),
      nextDueDate: nextDue,
      overdueInstallments,
      principalPaidCurrentYear: principalPaidCurrentYear.toNumber(),
    });
  } catch (error) {
    console.error("[personal/debts/summary GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
