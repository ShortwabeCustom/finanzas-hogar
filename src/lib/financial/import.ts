import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ImportStatementPayload, ImportSummary } from "@/types/financial";

const AMOUNT_MAX = 10_000_000;
const AMOUNT_MIN = -10_000_000;

function parseAmount(
  raw: number | null | undefined,
  label: string,
  errors: string[]
): number | null {
  if (raw === null || raw === undefined) return null;
  const value = parseFloat(String(raw));
  if (isNaN(value)) {
    errors.push(`${label}: valor no numérico ("${raw}")`);
    return null;
  }
  if (value > AMOUNT_MAX || value < AMOUNT_MIN) {
    errors.push(`${label}: monto fuera de rango (${value})`);
    return null;
  }
  return value;
}

// Deterministic hash per transaction — prevents exact duplicates within a statement.
// Uses date + description + amounts as the natural key.
function txnHash(
  transactionDate: string,
  description: string,
  chargeAmount: number | null,
  creditAmount: number | null
): string {
  const raw = `${transactionDate}|${description.trim().toLowerCase()}|${chargeAmount ?? ""}|${creditAmount ?? ""}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function importStatement(
  payload: ImportStatementPayload,
  userId: string
): Promise<ImportSummary> {
  const errors: string[] = [];
  const totalTransactions = payload.transactions.length;

  // ── 1. Find-or-create BankAccount ───────────────────────────────────────────
  // upsert can't filter on nullable fields in compound unique keys, so we use
  // findFirst + create/update. The DB also has a partial unique index covering
  // the null-cardNumber case (applied separately via raw SQL).
  let account = await prisma.bankAccount.findFirst({
    where: {
      userId,
      bankName: payload.account.bankName,
      productName: payload.account.productName,
      cardNumber: payload.account.cardNumber ?? null,
    },
  });

  if (!account) {
    account = await prisma.bankAccount.create({
      data: {
        userId,
        bankName: payload.account.bankName,
        productName: payload.account.productName,
        accountNumber: payload.account.accountNumber ?? null,
        clabe: payload.account.clabe ?? null,
        cardNumber: payload.account.cardNumber ?? null,
        currency: payload.account.currency ?? "MXN",
        type: payload.account.type,
      },
    });
  } else {
    account = await prisma.bankAccount.update({
      where: { id: account.id },
      data: {
        accountNumber: payload.account.accountNumber ?? null,
        clabe: payload.account.clabe ?? null,
        currency: payload.account.currency ?? "MXN",
      },
    });
  }

  // ── 2. Idempotency check — skip if statement already imported ────────────────
  const existing = await prisma.bankStatement.findUnique({
    where: {
      accountId_periodStart_periodEnd: {
        accountId: account.id,
        periodStart: new Date(payload.statement.periodStart),
        periodEnd: new Date(payload.statement.periodEnd),
      },
    },
  });

  if (existing) {
    return { imported: 0, skipped: totalTransactions, errors: [] };
  }

  // ── 3. Validate statement-level amounts ──────────────────────────────────────
  const openingBalance = parseAmount(payload.statement.openingBalance, "openingBalance", errors);
  const closingBalance = parseAmount(payload.statement.closingBalance, "closingBalance", errors);
  const totalCharges   = parseAmount(payload.statement.totalCharges,   "totalCharges",   errors);
  const totalCredits   = parseAmount(payload.statement.totalCredits,   "totalCredits",   errors);

  // ── 4. Create BankStatement ──────────────────────────────────────────────────
  const statement = await prisma.bankStatement.create({
    data: {
      accountId: account.id,
      periodStart: new Date(payload.statement.periodStart),
      periodEnd:   new Date(payload.statement.periodEnd),
      cutDate:     payload.statement.cutDate ? new Date(payload.statement.cutDate) : null,
      openingBalance: openingBalance ?? null,
      closingBalance: closingBalance ?? null,
      totalCharges:   totalCharges   ?? null,
      totalCredits:   totalCredits   ?? null,
      sourceFile: payload.statement.sourceFile ?? null,
    },
  });

  // ── 5. Validate, hash, and bulk-insert transactions ──────────────────────────
  const rows: Prisma.BankTransactionCreateManyInput[] = [];

  for (let i = 0; i < payload.transactions.length; i++) {
    const txn    = payload.transactions[i];
    const prefix = `transacción[${i}] "${txn.description}"`;

    const chargeAmount = parseAmount(txn.chargeAmount, `${prefix} chargeAmount`, errors);
    const creditAmount = parseAmount(txn.creditAmount, `${prefix} creditAmount`, errors);
    const balance      = parseAmount(txn.balance,      `${prefix} balance`,      errors);

    rows.push({
      statementId:     statement.id,
      accountId:       account.id,
      transactionDate: new Date(txn.transactionDate),
      description:     txn.description,
      reference:       txn.reference    ?? null,
      chargeAmount:    chargeAmount     ?? null,
      creditAmount:    creditAmount     ?? null,
      balance:         balance          ?? null,
      rawOcrText:      txn.rawOcrText   ?? null,
      txnHash:         txnHash(txn.transactionDate, txn.description, chargeAmount, creditAmount),
    });
  }

  const result = await prisma.bankTransaction.createMany({
    data: rows,
    skipDuplicates: true,
  });

  return {
    imported: result.count,
    skipped:  totalTransactions - result.count,
    errors,
  };
}
