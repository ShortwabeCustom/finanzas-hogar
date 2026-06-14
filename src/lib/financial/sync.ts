import { prisma } from "@/lib/prisma";
import type { PersonalCategory, PersonalCard, BankTransaction, BankAccount, PaymentMethod } from "@prisma/client";

type TxnWithAccount = BankTransaction & { account: BankAccount };

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Remove OCR artifacts and truncate
export function cleanName(desc: string, max = 60): string {
  return desc
    .replace(/[â€œâ€™â€¦âÃ¡Ã©Ã­Ã³ÃºÃ±]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ── Auto-categorization ───────────────────────────────────────────────────────

export function autoCategory(
  desc: string,
  isCredit: boolean,
  categories: PersonalCategory[]
): string {
  const byName = (keyword: string) =>
    categories.find((c) => norm(c.name).includes(norm(keyword)))?.id;

  // ── Créditos / abonos ──
  if (isCredit) {
    if (contains(desc, "NOMINA", "PAGO DE NOMINA"))
      return byName("Ingresos") ?? byName("Deposito") ?? categories[0].id;
    return byName("Transferencias Recibidas") ?? byName("Deposito") ?? categories[0].id;
  }

  // ── Cargos / gastos ──
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

  if (contains(desc, "INTERES", "IVA 16", "COMISION", "PENALIZACION", "CARGO PAGO TARJETA",
    "PAGO TARJETA"))
    return byName("Comision") ?? categories[0].id;

  if (contains(desc, "SPEI", "TRANSFERENCIA A", "TRANSF RAPIDA SPEI", "PAGO TRANSF",
    "ENVIADO A", "HAIR SALON"))
    return byName("Transferencias Enviadas") ?? categories[0].id;

  if (contains(desc, "ROPA", "ZARA", "H&M", "FOREVER", "PULL", "BERSHKA", "STRADIVARI"))
    return byName("Ropa") ?? categories[0].id;

  if (contains(desc, "HOGAR", "IKEA", "HOME DEPOT", "SODIMAC", "LIVERPOOL", "PALACIO"))
    return byName("Hogar") ?? categories[0].id;

  return byName("Otros") ?? categories[0].id;
}

// ── Payment method + card mapping ─────────────────────────────────────────────

function mapPaymentSource(
  txn: TxnWithAccount,
  isCredit: boolean,
  cards: PersonalCard[]
): { paymentMethod: PaymentMethod; personalCardId: string | null } {
  const cardByLast4 = (last4: string | null) =>
    last4 ? (cards.find((c) => c.last4Digits === last4)?.id ?? null) : null;

  if (txn.account.type === "CREDIT") {
    const cardId = cardByLast4(txn.account.cardNumber);
    return { paymentMethod: "CREDIT_CARD" as PaymentMethod, personalCardId: cardId };
  }

  // CHECKING account
  if (isCredit) {
    return { paymentMethod: "TRANSFER" as PaymentMethod, personalCardId: null };
  }
  if (contains(txn.description, "SPEI", "TRANSFERENCIA", "TRANSF", "NOMINA", "DOMICILIACION"))
    return { paymentMethod: "TRANSFER" as PaymentMethod, personalCardId: null };
  if (contains(txn.description, "CONSUMO", "CARGO"))
    return { paymentMethod: "DEBIT_CARD" as PaymentMethod, personalCardId: null };

  return { paymentMethod: "TRANSFER" as PaymentMethod, personalCardId: null };
}

// ── Main sync function ────────────────────────────────────────────────────────

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

export async function syncBankToPersonalPayments(userId: string): Promise<SyncResult> {
  const [categories, cards, transactions] = await Promise.all([
    prisma.personalCategory.findMany({ where: { userId, active: true } }),
    prisma.personalCard.findMany({ where: { userId, active: true } }),
    prisma.bankTransaction.findMany({
      where: { account: { userId } },
      include: { account: true },
      orderBy: { transactionDate: "asc" },
    }),
  ]);

  if (categories.length === 0) {
    return { synced: 0, skipped: 0, errors: ["El usuario no tiene categorías personales"] };
  }

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Pre-compute all folios and batch-lookup existing ones — avoids N+1 queries
  const txnFolios = transactions.map((txn) => {
    const hash = txn.txnHash ?? txn.id;
    return `BNK-${hash.substring(0, 16).toUpperCase()}`;
  });
  const existingFolios = new Set(
    (
      await prisma.personalPayment.findMany({
        where: { folio: { in: txnFolios } },
        select: { folio: true },
      })
    ).map((p) => p.folio)
  );

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];
    const charge = Number(txn.chargeAmount ?? 0);
    const credit = Number(txn.creditAmount ?? 0);

    // Skip zero-amount rows
    if (charge === 0 && credit === 0) {
      skipped++;
      continue;
    }

    const isCredit = credit > 0 && charge === 0;
    const amount   = isCredit ? credit : charge;

    // Stable folio derived from txnHash — guarantees idempotency via unique constraint
    const folio = txnFolios[i];

    if (existingFolios.has(folio)) {
      skipped++;
      continue;
    }

    const categoryId = autoCategory(txn.description, isCredit, categories);
    const { paymentMethod, personalCardId } = mapPaymentSource(txn as TxnWithAccount, isCredit, cards);

    try {
      await prisma.personalPayment.create({
        data: {
          userId,
          folio,
          name:              cleanName(txn.description, 60),
          concept:           txn.description,
          amount,
          categoryId,
          personalCardId,
          period:            "ONCE",
          status:            "PAID",
          paymentMethod,
          paymentDate:       txn.transactionDate,
          notes:             `[banco:${txn.id}]`,
          bankTransactionId: txn.id,
          sourceStatementId: txn.statementId,
          importedFromBank:  true,
        },
      });
      existingFolios.add(folio);
      synced++;
    } catch (e: any) {
      // P2002 = unique constraint — race condition or duplicate hash collision
      if (e?.code === "P2002") {
        skipped++;
      } else {
        errors.push(`${folio}: ${e?.message ?? "error desconocido"}`);
      }
    }
  }

  return { synced, skipped, errors };
}
