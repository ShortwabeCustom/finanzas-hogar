import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

class RouteError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isRouteError(error: unknown): error is RouteError {
  return error instanceof RouteError;
}

/**
 * POST /api/personal/accounts/merge
 * Merges an owned source account into another owned target account.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const userId = session.user.id;

    let body: { sourceAccountId?: string; targetAccountId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const sourceAccountId = body.sourceAccountId?.trim();
    const targetAccountId = body.targetAccountId?.trim();

    if (!sourceAccountId || !targetAccountId) {
      return NextResponse.json({ error: "Cuenta origen y destino requeridas" }, { status: 400 });
    }

    if (sourceAccountId === targetAccountId) {
      return NextResponse.json({ error: "La cuenta origen y destino deben ser diferentes" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [sourceAccount, targetAccount] = await Promise.all([
        tx.bankAccount.findFirst({
          where: { id: sourceAccountId, userId },
          select: { id: true },
        }),
        tx.bankAccount.findFirst({
          where: { id: targetAccountId, userId },
          select: { id: true },
        }),
      ]);

      if (!sourceAccount) {
        throw new RouteError(404, "Cuenta origen no encontrada");
      }

      if (!targetAccount) {
        throw new RouteError(404, "Cuenta destino no encontrada");
      }

      const sourceStatements = await tx.bankStatement.findMany({
        where: { accountId: sourceAccountId },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
        },
        orderBy: { periodStart: "asc" },
      });

      let mergedStatements = 0;
      let movedTransactions = 0;
      let skippedDuplicates = 0;

      for (const sourceStatement of sourceStatements) {
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

          movedTransactions += moved.count;
          mergedStatements += 1;
          continue;
        }

        const [sourceTransactions, targetTransactions] = await Promise.all([
          tx.bankTransaction.findMany({
            where: { statementId: sourceStatement.id },
            select: { id: true, txnHash: true },
          }),
          tx.bankTransaction.findMany({
            where: {
              statementId: targetStatement.id,
              txnHash: { not: null },
            },
            select: { txnHash: true },
          }),
        ]);

        const targetHashes = new Set(targetTransactions.map((txn) => txn.txnHash).filter((hash): hash is string => hash !== null));
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
            data: {
              statementId: targetStatement.id,
              accountId: targetAccountId,
            },
          });
        }

        await tx.bankStatement.delete({ where: { id: sourceStatement.id } });

        movedTransactions += moveIds.length;
        skippedDuplicates += duplicateIds.length;
        mergedStatements += 1;
      }

      const remainingStatements = await tx.bankStatement.count({
        where: { accountId: sourceAccountId },
      });

      if (remainingStatements === 0) {
        await tx.bankAccount.delete({ where: { id: sourceAccountId } });
      }

      return {
        mergedStatements,
        movedTransactions,
        skippedDuplicates,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (isRouteError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[personal/accounts merge POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
