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
      include: {
        personalPayment: { select: { id: true, folio: true } },
      },
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[financial/transactions GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/financial/transactions
 * Creates a manual bank transaction for the session user.
 * Body: { statementId, accountId, transactionDate, description, reference?, chargeAmount?, creditAmount?, balance? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const userId = session.user.id;
    const body = await req.json();
    const { statementId, accountId, transactionDate, description, reference, chargeAmount, creditAmount, balance } = body as {
      statementId: string;
      accountId: string;
      transactionDate: string;
      description: string;
      reference?: string | null;
      chargeAmount?: number | null;
      creditAmount?: number | null;
      balance?: number | null;
    };

    if (!statementId || !accountId || !transactionDate || !description?.trim()) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const account = await prisma.bankAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const txn = await prisma.bankTransaction.create({
      data: {
        statementId,
        accountId,
        transactionDate: new Date(transactionDate + "T12:00:00"),
        description: description.trim(),
        reference: reference?.trim() || null,
        chargeAmount: chargeAmount != null ? chargeAmount : null,
        creditAmount: creditAmount != null ? creditAmount : null,
        balance: balance != null ? balance : null,
      },
    });

    return NextResponse.json(txn, { status: 201 });
  } catch (error) {
    console.error("[financial/transactions POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
