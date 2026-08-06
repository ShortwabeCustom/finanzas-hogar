import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePaginationParams, buildPaginatedResponse } from "@/lib/pagination";

/**
 * GET /api/personal/statements
 * Session-protected. Returns BankStatements for the authenticated user with cursor pagination.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? "";

    const { limit, cursor } = parsePaginationParams(
      searchParams.get("limit"),
      searchParams.get("cursor")
    );

    const where: Record<string, unknown> = { account: { userId, scope: "PERSONAL" } };
    if (accountId) where.accountId = accountId;

    if (cursor) {
      where.periodStart = { ...((where.periodStart as any) || {}), lt: new Date(cursor) };
    }

    const statements = await prisma.bankStatement.findMany({
      where,
      include: { account: true },
      orderBy: { periodStart: "desc" },
      take: limit + 1,
    });

    return NextResponse.json(statements);
  } catch (error) {
    console.error("[personal/statements GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
