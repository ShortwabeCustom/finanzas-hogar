import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PERIOD_CONFLICT_MESSAGE = "La cuenta destino ya tiene un estado de cuenta para este periodo.";

class RouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isRouteError(error: unknown): error is RouteError {
  return error instanceof RouteError;
}

/**
 * PATCH /api/statements/[id]/move
 * Moves a HOUSEHOLD bank statement to another HOUSEHOLD account.
 * Optionally merges when the destination already has the same period.
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

    let body: { targetAccountId?: string; mergeIfPeriodExists?: boolean };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const targetAccountId = body.targetAccountId?.trim();
    const mergeIfPeriodExists = Boolean(body.mergeIfPeriodExists);

    if (!targetAccountId) {
      return NextResponse.json({ error: "Cuenta destino requerida" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const sourceStatement = await tx.bankStatement.findFirst({
        where: { id, account: { scope: "HOUSEHOLD" } },
        select: { id: true, accountId: true, periodStart: true, periodEnd: true },
      });

      if (!sourceStatement) throw new RouteError(404, "No encontrado");

      const targetAccount = await tx.bankAccount.findFirst({
        where: { id: targetAccountId, scope: "HOUSEHOLD" },
        select: { id: true },
      });

      if (!targetAccount) throw new RouteError(404, "Cuenta destino no encontrada");

      if (sourceStatement.accountId === targetAccountId) {
        return { movedTransactions: 0, skippedDuplicates: 0, targetStatementId: sourceStatement.id };
      }

      const targetStatement = await tx.bankStatement.findFirst({
        where: {
          accountId: targetAccountId,
          periodStart: sourceStatement.periodStart,
          periodEnd: sourceStatement.periodEnd,
        },
        select: { id: true },
      });

      if (!targetStatement) {
        await tx.bankStatement.update({
          where: { id: sourceStatement.id },
          data: { accountId: targetAccountId },
        });

        const moved = await tx.bankTransaction.updateMany({
          where: { statementId: sourceStatement.id },
          data: { accountId: targetAccountId },
        });

        return { movedTransactions: moved.count, skippedDuplicates: 0, targetStatementId: sourceStatement.id };
      }

      if (!mergeIfPeriodExists) throw new RouteError(409, PERIOD_CONFLICT_MESSAGE);

      const [sourceTransactions, targetTransactions] = await Promise.all([
        tx.bankTransaction.findMany({
          where: { statementId: sourceStatement.id },
          select: { id: true, txnHash: true },
        }),
        tx.bankTransaction.findMany({
          where: { statementId: targetStatement.id, txnHash: { not: null } },
          select: { txnHash: true },
        }),
      ]);

      const targetHashes = new Set(
        targetTransactions.map((t) => t.txnHash).filter((h): h is string => h !== null)
      );
      const duplicateIds: string[] = [];
      const moveIds: string[] = [];

      for (const txn of sourceTransactions) {
        if (txn.txnHash !== null && targetHashes.has(txn.txnHash)) {
          duplicateIds.push(txn.id);
        } else {
          moveIds.push(txn.id);
        }
      }

      if (duplicateIds.length > 0) {
        await tx.bankTransaction.deleteMany({ where: { id: { in: duplicateIds } } });
      }

      if (moveIds.length > 0) {
        await tx.bankTransaction.updateMany({
          where: { id: { in: moveIds } },
          data: { statementId: targetStatement.id, accountId: targetAccountId },
        });
      }

      await tx.bankStatement.delete({ where: { id: sourceStatement.id } });

      return {
        movedTransactions: moveIds.length,
        skippedDuplicates: duplicateIds.length,
        targetStatementId: targetStatement.id,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (isRouteError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[statements move PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
