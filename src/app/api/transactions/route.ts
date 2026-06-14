import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/transactions
 * Returns HOUSEHOLD bank transactions (scope=HOUSEHOLD accounts).
 * All authenticated users can read.
 *
 * Query params: accountId, date_from, date_to, type, search
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? "";
    const dateFrom  = searchParams.get("date_from") ?? "";
    const dateTo    = searchParams.get("date_to") ?? "";
    const type      = searchParams.get("type") ?? "";
    const search    = searchParams.get("search") ?? "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { account: { scope: "HOUSEHOLD" } };

    if (accountId) where.accountId = accountId;

    if (dateFrom || dateTo) {
      where.transactionDate = {};
      if (dateFrom) where.transactionDate.gte = new Date(dateFrom);
      if (dateTo)   where.transactionDate.lte = new Date(dateTo);
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
        payment: { select: { id: true, folio: true } },
      },
      orderBy: { transactionDate: "desc" },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("[transactions GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * POST /api/transactions
 * Creates a manual HOUSEHOLD bank transaction.
 * VIEWER cannot create.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

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

    const account = await prisma.bankAccount.findFirst({
      where: { id: accountId, scope: "HOUSEHOLD" },
    });
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
    console.error("[transactions POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
