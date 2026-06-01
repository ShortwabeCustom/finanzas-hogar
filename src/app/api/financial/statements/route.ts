import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateInternalToken } from "@/lib/internalAuth";
import { importStatement } from "@/lib/financial/import";
import type { ImportStatementPayload } from "@/types/financial";

/**
 * POST /api/financial/statements
 * Internal route (x-internal-token). Receives an OCR pipeline payload,
 * upserts the account, and imports the statement + transactions.
 *
 * Body: ImportStatementPayload & { userId: string }
 */
export async function POST(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  try {
    const body = await req.json();

    const { userId, ...payload } = body as ImportStatementPayload & { userId: string };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    if (!payload.account || !payload.statement || !Array.isArray(payload.transactions)) {
      return NextResponse.json(
        { error: "Estructura de payload inválida: se requieren account, statement y transactions" },
        { status: 400 }
      );
    }

    const summary = await importStatement(payload, userId);

    return NextResponse.json(summary, { status: 201 });
  } catch (error) {
    console.error("[financial/statements POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * GET /api/financial/statements
 * User-facing route (NextAuth session). Returns statements for the session
 * user, optionally filtered by accountId.
 *
 * Query params:
 *   accountId — optional, filter by account
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? "";

    const where: any = {
      account: { userId },
    };

    if (accountId) where.accountId = accountId;

    const statements = await prisma.bankStatement.findMany({
      where,
      include: {
        account: true,
      },
      orderBy: { periodStart: "desc" },
    });

    return NextResponse.json(statements);
  } catch (error) {
    console.error("[financial/statements GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
