import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { Category, PaymentMethod, Prisma } from "@prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contains(desc: string, ...keywords: string[]) {
  const d = norm(desc);
  return keywords.some((k) => d.includes(k));
}

function cleanName(desc: string, max = 60): string {
  return desc
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function autoCategory(desc: string, isCredit: boolean, categories: Category[]): string {
  const byName = (keyword: string) =>
    categories.find((c) => norm(c.name).includes(norm(keyword)))?.id;

  if (isCredit) {
    return byName("Ingresos") ?? byName("Deposito") ?? byName("Transferencias") ?? categories[0].id;
  }

  if (contains(desc, "COSTCO", "SORIANA", "WALMART", "CHEDRAUI", "SUPERAMA", "HEB", "LA COMER", "FRESKO"))
    return byName("Supermercado") ?? byName("Despensa") ?? categories[0].id;
  if (contains(desc, "FARMACIA", "HOSPITAL", "CLINICA", "MEDIC", "LABORAT", "DENTAL"))
    return byName("Salud") ?? categories[0].id;
  if (contains(desc, "NETFLIX", "SPOTIFY", "DISNEY", "VIX", "AMAZON PRIME", "GOOGLE", "APPLE",
    "SMART FIT", "TOTALPLAY"))
    return byName("Suscripciones") ?? byName("Servicios") ?? categories[0].id;
  if (contains(desc, "TELCEL", "TELMEX", "INTERNET", "AGUA", "LUZ", "CFE", "SOCAGAS", "GAS NATURAL"))
    return byName("Servicios") ?? categories[0].id;
  if (contains(desc, "GASOLINERA", "GASOLINA", "GAS STATION", "PEMEX", "SHELL", "BP "))
    return byName("Gasolina") ?? byName("Transporte") ?? categories[0].id;
  if (contains(desc, "UBER", "DIDI", "INDRIVER", "TAXI", "METROBUS", "METRO", "MUEVE CIUDAD"))
    return byName("Transporte") ?? categories[0].id;
  if (contains(desc, "RENT", "ALQUILER", "DEPARTAMENTO", "ARRENDAMIENTO"))
    return byName("Renta") ?? byName("Hogar") ?? categories[0].id;
  if (contains(desc, "HOGAR", "IKEA", "HOME DEPOT", "SODIMAC", "LIVERPOOL", "PALACIO"))
    return byName("Hogar") ?? categories[0].id;
  if (contains(desc, "INTERES", "COMISION", "CARGO PAGO TARJETA", "PAGO TARJETA"))
    return byName("Pagos") ?? categories[0].id;
  if (contains(desc, "SPEI", "TRANSFERENCIA A", "TRANSF RAPIDA SPEI", "PAGO TRANSF"))
    return byName("Transferencias") ?? categories[0].id;

  return byName("Otros") ?? byName("Gastos") ?? categories[0].id;
}

function mapPaymentMethod(desc: string, accountType: string): PaymentMethod {
  const d = desc.toUpperCase();
  if (accountType === "CREDIT") return "CREDIT_CARD";
  if (d.includes("TRANSFERENCIA") || d.includes("TRASPASO") || d.includes("SPEI")) return "TRANSFER";
  if (accountType === "CHECKING") return "DEBIT_CARD";
  return "TRANSFER";
}

function computeFolio(
  txnHash: string | null,
  transactionDate: Date,
  description: string,
  amount: number,
  accountId: string
): string {
  const hash =
    txnHash ??
    createHash("sha256")
      .update(`${transactionDate.toISOString().slice(0, 10)}${description}${amount}${accountId}`)
      .digest("hex");
  return `HLD-${hash.substring(0, 16).toUpperCase()}`;
}

// ── POST /api/payments/from-transactions ─────────────────────────────────────

/**
 * Creates household Payment records from HOUSEHOLD BankTransactions.
 * Deduplicates by bankTransactionId (unique FK on Payment) and folio.
 * Body: { transactionIds: string[], defaults?: { status?, period? } }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const userId = session.user.id;
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.transactionIds) || body.transactionIds.length === 0) {
      return NextResponse.json(
        { error: "transactionIds es requerido y debe ser un arreglo no vacío" },
        { status: 400 }
      );
    }

    const { transactionIds, defaults } = body as {
      transactionIds: string[];
      defaults?: { status?: string; period?: string };
    };

    // Load transactions — must belong to HOUSEHOLD scope
    const txns = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds }, account: { scope: "HOUSEHOLD" } },
      include: { account: true },
    });

    if (txns.length !== transactionIds.length) {
      return NextResponse.json(
        { error: "Algunas transacciones no existen o no son del contexto Hogar" },
        { status: 404 }
      );
    }

    // Global categories (not personal)
    const categories = await prisma.category.findMany({
      where: { active: true, type: { in: ["PAYMENT", "BOTH"] } },
    });

    if (categories.length === 0) {
      return NextResponse.json(
        { error: "No hay categorías del hogar. Crea al menos una en Categorías." },
        { status: 422 }
      );
    }

    // Pre-compute folios
    const txnData = txns.map((txn) => {
      const charge = Number(txn.chargeAmount ?? 0);
      const credit = Number(txn.creditAmount ?? 0);
      const amount = credit > 0 && charge === 0 ? credit : charge;
      const folio = computeFolio(txn.txnHash, txn.transactionDate, txn.description, amount, txn.accountId);
      return { txn, charge, credit, amount, folio };
    });

    // Batch-check duplicates by bankTransactionId and folio on Payment
    const [existingByBankTxnId, existingByFolio] = await Promise.all([
      prisma.payment.findMany({
        where: { bankTransactionId: { in: transactionIds } },
        select: { bankTransactionId: true },
      }),
      prisma.payment.findMany({
        where: { folio: { in: txnData.map((d) => d.folio) } },
        select: { folio: true },
      }),
    ]);

    const knownBankTxnIds = new Set(
      existingByBankTxnId.map((p) => p.bankTransactionId as string)
    );
    const knownFolios = new Set(existingByFolio.map((p) => p.folio));

    const toCreate: Prisma.PaymentCreateManyInput[] = [];
    let skippedDuplicates = 0;

    for (const { txn, charge, credit, amount, folio } of txnData) {
      if (charge === 0 && credit === 0) { skippedDuplicates++; continue; }
      if (knownBankTxnIds.has(txn.id) || knownFolios.has(folio)) { skippedDuplicates++; continue; }

      const isCredit = credit > 0 && charge === 0;
      const paymentMethod = mapPaymentMethod(txn.description, txn.account.type);
      const categoryId = autoCategory(txn.description, isCredit, categories);

      const conceptParts = [txn.reference, txn.account.bankName, txn.account.productName].filter(Boolean);
      const concept = conceptParts.length > 0 ? conceptParts.join(" · ") : txn.description;

      toCreate.push({
        folio,
        name: cleanName(txn.description, 60),
        concept,
        amount,
        categoryId,
        period: (defaults?.period ?? "ONCE") as Prisma.PaymentCreateManyInput["period"],
        status: (defaults?.status ?? "PAID") as Prisma.PaymentCreateManyInput["status"],
        paymentMethod,
        dueDate: txn.transactionDate,
        paymentDate: txn.transactionDate,
        paidById: userId,
        bankTransactionId: txn.id,
        sourceStatementId: txn.statementId,
        importedFromBank: true,
      });

      knownFolios.add(folio);
      knownBankTxnIds.add(txn.id);
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        skippedDuplicates,
        failed: [],
        payments: [],
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      await tx.payment.createMany({
        data: toCreate,
        skipDuplicates: true,
      });

      return tx.payment.findMany({
        where: { folio: { in: toCreate.map((d) => d.folio as string) } },
        select: { id: true, folio: true, bankTransactionId: true },
      });
    });

    const actualSkipped = skippedDuplicates + (toCreate.length - created.length);

    return NextResponse.json({
      success: true,
      created: created.length,
      skippedDuplicates: actualSkipped,
      failed: [],
      payments: created.map((p) => ({ id: p.id, folio: p.folio, bankTransactionId: p.bankTransactionId })),
    });
  } catch (error) {
    console.error("[payments/from-transactions POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
