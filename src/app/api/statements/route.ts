import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/statements
 * Session-protected. Returns BankStatements with scope=HOUSEHOLD (shared).
 * All authenticated users can read household statements.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? "";

    const where: Record<string, unknown> = { account: { scope: "HOUSEHOLD" } };
    if (accountId) where.accountId = accountId;

    const statements = await prisma.bankStatement.findMany({
      where,
      include: { account: true },
      orderBy: { periodStart: "desc" },
    });

    return NextResponse.json(statements);
  } catch (error) {
    console.error("[statements GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
