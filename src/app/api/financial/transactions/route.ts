import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/financial/transactions
 * User-facing route (NextAuth session). Returns bank transactions for the
 * session user. Access control is enforced via account.userId.
 *
 * Query params:
 *   accountId  — optional, filter by account
 *   date_from  — optional "YYYY-MM-DD", inclusive lower bound on transactionDate
 *   date_to    — optional "YYYY-MM-DD", inclusive upper bound on transactionDate
 *   type       — optional "charge" | "credit"
 *   search     — optional, case-insensitive substring match on description
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? "";
    const dateFrom = searchParams.get("date_from") ?? "";
    const dateTo = searchParams.get("date_to") ?? "";
    const type = searchParams.get("type") ?? "";
    const search = searchParams.get("search") ?? "";

    // userId enforced through the nested account relation — never from client input
    const where: any = {
      account: { userId },
    };

    if (accountId) where.accountId = accountId;

    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom);
      if (dateTo) where.transactionDate.lte = new Date(dateTo);
    }

    if (type === "charge") {
      where.chargeAmount = { not: null };
    } else if (type === "credit") {
      where.creditAmount = { not: null };
    }

    if (search) {
      where.description = { contains: search, mode: "insensitive" };
    }

    const transactions = await prisma.bankTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[financial/transactions GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
