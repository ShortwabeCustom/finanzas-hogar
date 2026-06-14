import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";
import type { PersonalCategory, FinancialClass, PaymentMethod } from "@prisma/client";

// ── Helpers (mirror de sync.ts para mantener independencia) ──────────────────

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
    .replace(/[â€œâ€™â€¦âÃ¡Ã©Ã­Ã³ÃºÃ±]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function autoCategory(desc: string, isCredit: boolean, categories: PersonalCategory[]): string {
  const byName = (keyword: string) =>
    categories.find((c) => norm(c.name).includes(norm(keyword)))?.id;

  if (isCredit) {
    if (contains(desc, "NOMINA", "PAGO DE NOMINA"))
      return byName("Ingresos") ?? byName("Deposito") ?? categories[0].id;
    return byName("Transferencias Recibidas") ?? byName("Deposito") ?? categories[0].id;
  }

  if (contains(desc, "COSTCO", "SORIANA", "WALMART", "CHEDRAUI", "SUPERAMA", "HEB", "LA COMER", "FRESKO"))
    return byName("Supermercado") ?? categories[0].id;
  if (contains(desc, "REST ", "SUSHI", "ALITAS", "TOKS", "WINGSTOP", "LIV ", "TEMO", "SUMO",
    "CASATONO", "HAMBURG", "CINEPOLI", "ANTOJERIA", "CAMIONCITO", "BANCA FELIZ",
    "TAQUER", "PIZZ", "BURGER", "POLLO", "COMIDA", "RESTAURANTE", "ESPARTACO"))
    return byName("Restaurantes") ?? categories[0].id;
  if (contains(desc, "FARMACIA", "FARMACIAS GDL", "HOSPITAL", "CLINICA", "MEDIC", "LABORAT", "DENTAL"))
    return byName("Salud") ?? categories[0].id;
  if (contains(desc, "NETFLIX", "SPOTIFY", "DISCORD", "DISNEY", "VIX", "EPIC GAMES", "STEAM",
    "AMAZON PRIME", "GOOGLE ONE", "GOOGLE PLAY", "APPLE", "XBOX", "PARAMOUNT", "HBO",
    "SMART FIT", "TOTALPLAY", "F1.COM"))
    return byName("Suscripciones") ?? categories[0].id;
  if (contains(desc, "TELCEL", "TELMEX", "INTERNET", "VOLKSWAGEN BANK", "DOMICILIACION",
    "SERVICIO", "AGUA", "LUZ", "CFE", "SOCAGAS", "GAS NATURAL", "CONEKTA"))
    return byName("Servicios") ?? categories[0].id;
  if (contains(desc, "EDUCACION", "ESCUELA", "COLEGIO", "UNIVERSIDAD", "UDEC", "CURSO", "CAPA"))
    return byName("Educaci") ?? categories[0].id;
  if (contains(desc, "GASOLINERA", "GASOLINA", "GAS STATION", "MUEVE CIUDAD", "UBER", "DIDI",
    "INDRIVER", "TAXI", "METROBUS", "METRO", "PEMEX", "SHELL", "BP "))
    return byName("Gasolina") ?? byName("Transporte") ?? categories[0].id;
  if (contains(desc, "OXXO", "SEVEN", "7-ELEVEN", "TIENDA", "MINISUP", "ABARROTES"))
    return byName("Alimentaci") ?? categories[0].id;
  if (contains(desc, "INTERES", "IVA 16", "COMISION", "PENALIZACION", "CARGO PAGO TARJETA", "PAGO TARJETA"))
    return byName("Comision") ?? categories[0].id;
  if (contains(desc, "SPEI", "TRANSFERENCIA A", "TRANSF RAPIDA SPEI", "PAGO TRANSF", "ENVIADO A", "HAIR SALON"))
    return byName("Transferencias Enviadas") ?? categories[0].id;
  if (contains(desc, "ROPA", "ZARA", "H&M", "FOREVER", "PULL", "BERSHKA", "STRADIVARI"))
    return byName("Ropa") ?? categories[0].id;
  if (contains(desc, "HOGAR", "IKEA", "HOME DEPOT", "SODIMAC", "LIVERPOOL", "PALACIO"))
    return byName("Hogar") ?? categories[0].id;

  return byName("Otros") ?? categories[0].id;
}

function mapFinancialClass(desc: string, charge: number, credit: number): FinancialClass {
  const d = desc.toUpperCase();
  const transferPatterns = ["PAGO TARJETA", "PAGO DE TARJETA", "TRANSFERENCIA ENTRE CUENTAS", "TRASPASO"];
  if (transferPatterns.some((p) => d.includes(p))) return "TRANSFER";
  if (credit > 0 && charge === 0) return "INCOME";
  return "EXPENSE";
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
  const hash = txnHash ?? createHash("sha256")
    .update(`${transactionDate.toISOString().slice(0, 10)}${description}${amount}${accountId}`)
    .digest("hex");
  return `BNK-${hash.substring(0, 16).toUpperCase()}`;
}

// ── POST /api/personal/payments/from-transactions ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const userId = session.user.id;
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.transactionIds) || body.transactionIds.length === 0) {
      return NextResponse.json({ error: "transactionIds es requerido y debe ser un arreglo no vacío" }, { status: 400 });
    }

    const { transactionIds, defaults } = body as {
      transactionIds: string[];
      defaults?: { status?: string; period?: string };
    };

    // Carga transacciones con cuenta
    const txns = await prisma.bankTransaction.findMany({
      where: { id: { in: transactionIds } },
      include: { account: true },
    });

    // Validar ownership — todas deben pertenecer al usuario en sesión
    const unauthorized = txns.filter((t) => t.account.userId !== userId);
    if (unauthorized.length > 0) {
      return NextResponse.json({ error: "Transacciones no autorizadas" }, { status: 403 });
    }
    if (txns.length !== transactionIds.length) {
      return NextResponse.json({ error: "Algunas transacciones no existen o no pertenecen a tu cuenta" }, { status: 404 });
    }

    // Categorías y tarjetas del usuario
    const [categories, cards] = await Promise.all([
      prisma.personalCategory.findMany({ where: { userId, active: true } }),
      prisma.personalCard.findMany({ where: { userId, active: true } }),
    ]);

    if (categories.length === 0) {
      return NextResponse.json(
        { error: "No tienes categorías personales. Crea al menos una en Mis Categorías antes de importar movimientos." },
        { status: 422 }
      );
    }

    // Pre-calcular folios
    const txnData = txns.map((txn) => {
      const charge = Number(txn.chargeAmount ?? 0);
      const credit = Number(txn.creditAmount ?? 0);
      const amount = credit > 0 && charge === 0 ? credit : charge;
      const folio = computeFolio(txn.txnHash, txn.transactionDate, txn.description, amount, txn.accountId);
      return { txn, charge, credit, amount, folio };
    });

    // Batch-check duplicados por bankTransactionId y por folio
    const [existingByBankTxnId, existingByFolio] = await Promise.all([
      prisma.personalPayment.findMany({
        where: { bankTransactionId: { in: transactionIds } },
        select: { bankTransactionId: true },
      }),
      prisma.personalPayment.findMany({
        where: { folio: { in: txnData.map((d) => d.folio) } },
        select: { folio: true },
      }),
    ]);

    const knownBankTxnIds = new Set(existingByBankTxnId.map((p) => p.bankTransactionId as string));
    const knownFolios = new Set(existingByFolio.map((p) => p.folio));

    // Construir lista de pagos a crear
    type PaymentDraft = Parameters<typeof prisma.personalPayment.create>[0]["data"];
    const toCreate: PaymentDraft[] = [];
    let skippedDuplicates = 0;

    for (const { txn, charge, credit, amount, folio } of txnData) {
      // Sin monto
      if (charge === 0 && credit === 0) {
        skippedDuplicates++;
        continue;
      }
      // Duplicado por bankTransactionId o folio
      if (knownBankTxnIds.has(txn.id) || knownFolios.has(folio)) {
        skippedDuplicates++;
        continue;
      }

      const isCredit = credit > 0 && charge === 0;
      const financialClass = mapFinancialClass(txn.description, charge, credit);
      const paymentMethod = mapPaymentMethod(txn.description, txn.account.type);
      const categoryId = autoCategory(txn.description, isCredit, categories);

      // Buscar tarjeta por últimos 4 dígitos de la cuenta bancaria
      const accountLast4 = txn.account.cardNumber?.replace(/\D/g, "").slice(-4) ?? null;
      const matchedCard = accountLast4 ? cards.find((c) => c.last4Digits === accountLast4) : null;

      const conceptParts = [txn.reference, txn.account.bankName, txn.account.productName].filter(Boolean);
      const concept = conceptParts.length > 0 ? conceptParts.join(" · ") : txn.description;

      toCreate.push({
        userId,
        folio,
        name: cleanName(txn.description, 60),
        concept,
        amount,
        categoryId,
        personalCardId: matchedCard?.id ?? null,
        period: (defaults?.period ?? "ONCE") as any,
        status: (defaults?.status ?? "PAID") as any,
        paymentMethod,
        financialClass,
        type: financialClass,
        dueDate: txn.transactionDate,
        paymentDate: txn.transactionDate,
        bankTransactionId: txn.id,
        sourceStatementId: txn.statementId,
        importedFromBank: true,
      });

      // Registrar en sets para evitar duplicados dentro del mismo batch
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

    // Crear todos en una sola transacción de DB
    const created = await prisma.$transaction(async (tx) => {
      await tx.personalPayment.createMany({
        data: toCreate as any[],
        skipDuplicates: true,
      });

      return tx.personalPayment.findMany({
        where: { folio: { in: toCreate.map((d) => (d as any).folio) }, userId },
        select: { id: true, folio: true, bankTransactionId: true },
      });
    });

    // Reconciliar: si createMany omitió alguno por race condition
    const actualSkipped = skippedDuplicates + (toCreate.length - created.length);

    return NextResponse.json({
      success: true,
      created: created.length,
      skippedDuplicates: actualSkipped,
      failed: [],
      payments: created.map((p) => ({
        id: p.id,
        folio: p.folio,
        bankTransactionId: p.bankTransactionId,
      })),
    });
  } catch (error) {
    console.error("[personal/payments/from-transactions POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
