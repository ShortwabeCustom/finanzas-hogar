import type { ImportStatementPayload } from "@/types/financial";

// ── Spanish month abbreviations → zero-padded month number ───────────────────
const MONTH_MAP: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04",
  MAY: "05", JUN: "06", JUL: "07", AGO: "08",
  SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

function spanishDateToISO(d: string): string {
  const [day, mon, year] = d.split("-");
  const mm = MONTH_MAP[mon?.toUpperCase()];
  if (!mm || !year || !day) throw new Error(`Fecha inválida: ${d}`);
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

// Strips up to `n` trailing decimal amounts from a string, returning remainder + amounts.
// Works right-to-left so amounts in the middle of descriptions are untouched.
function popTrailingAmounts(str: string, n: number): { text: string; amounts: number[] } {
  const re = /\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/;
  const amounts: number[] = [];
  let text = str;
  for (let i = 0; i < n; i++) {
    const m = text.match(re);
    if (!m) break;
    amounts.unshift(parseAmount(m[1]));
    text = text.slice(0, -m[0].length);
  }
  return { text: text.trim(), amounts };
}

const DATE_RE = /^\d{2}-[A-Z]{3}-\d{4}/i;

/** Quick check — avoids full parse for non-Santander checking PDFs */
export function isSantanderCheckingPDF(text: string): boolean {
  // Normalize: strip combining diacritical marks (U+0300–U+036F), then uppercase
  const norm = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

  const isSantander = norm.includes("SANTANDER");
  // Santander Cuenta Corriente and Nómina statements both have this balance marker
  const hasOpeningBalance =
    norm.includes("SALDO FINAL DEL PERIODO ANTERIOR") ||
    norm.includes("SALDO FINAL DEL PERIODO:") ||
    norm.includes("SALDO ANTERIOR");
  // Credit/debit column headers vary between accounts
  const hasDepositCol = norm.includes("DEPOSITO") || norm.includes("ABONO");
  const hasWithdrawalCol = norm.includes("RETIRO") || norm.includes("CARGO");

  return isSantander && hasOpeningBalance && hasDepositCol && hasWithdrawalCol;
}

interface SectionData {
  productName: string;
  accountNumber: string;
  clabe: string | undefined;
  openingBalance: number;
  closingBalance: number;
  totalCredits: number;
  totalCharges: number;
  transactions: ImportStatementPayload["transactions"];
}

/**
 * Parses a Santander Cuenta Corriente (debit) PDF and returns one
 * ImportStatementPayload per account section that contains transactions.
 *
 * Throws with a user-friendly Spanish message on structural errors.
 */
export async function parseSantanderPDF(buffer: Buffer): Promise<ImportStatementPayload[]> {
  // pdf-parse v2: class-based API, dynamic import keeps it out of the Turbopack bundle
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();

  // ── Extract period ──────────────────────────────────────────────────────────
  const periodMatch = text.match(
    /PERIODO DEL\s+(\d{2}-[A-Z]{3}-\d{4})\s+AL\s+(\d{2}-[A-Z]{3}-\d{4})/i
  );
  if (!periodMatch) throw new Error("No se encontró el período en el PDF");
  const periodStart = spanishDateToISO(periodMatch[1]);
  const periodEnd   = spanishDateToISO(periodMatch[2]);

  // ── Extract CLABE (18 digits, unique enough) ─────────────────────────────
  const clabeMatch = text.match(/CUENTA CLABE[:\s]*([\d]{18})/i);
  const globalClabe = clabeMatch?.[1];

  // ── Walk lines and find transaction sections ──────────────────────────────
  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean);
  const sections: SectionData[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("SALDO FINAL DEL PERIODO ANTERIOR:")) continue;

    // ── Account header is a few lines before this marker ──────────────────
    let productName = "Cuenta Corriente";
    let accountNumber = "";

    for (let k = 1; k <= 6; k++) {
      const candidate = lines[i - k] ?? "";
      // Account numbers look like "60-59271120-6" or "08-00028958-4"
      const accMatch = candidate.match(/(\d{2}-\d+-\d+)\s*$/);
      if (accMatch) {
        accountNumber = accMatch[1];
        productName = candidate.replace(accountNumber, "").trim() || "Cuenta Corriente";
        break;
      }
    }

    // ── Opening balance ───────────────────────────────────────────────────
    const openBalMatch = lines[i].match(
      /SALDO FINAL DEL PERIODO ANTERIOR:\s*\$?([\d,]+\.\d{2})/i
    );
    const openingBalance = openBalMatch ? parseAmount(openBalMatch[1]) : 0;

    // ── Collect transaction lines until TOTAL row ─────────────────────────
    const txLines: string[] = [];
    i++;
    while (i < lines.length && !lines[i].match(/^TOTAL\b/i)) {
      // Skip the column header row
      if (!lines[i].match(/^FECHA\s+FOLIO\s+DESCRIPCION/i)) {
        txLines.push(lines[i]);
      }
      i++;
    }

    // ── TOTAL row → totalCredits (DEPOSITO) and totalCharges (RETIRO) ─────
    let totalCredits = 0;
    let totalCharges = 0;
    if (lines[i]?.match(/^TOTAL\b/i)) {
      const { amounts } = popTrailingAmounts(lines[i], 2);
      if (amounts.length === 2) { totalCredits = amounts[0]; totalCharges = amounts[1]; }
      i++;
    }

    // ── Closing balance ───────────────────────────────────────────────────
    let closingBalance = 0;
    if (lines[i]?.includes("SALDO FINAL DEL PERIODO:")) {
      const m = lines[i].match(/SALDO FINAL DEL PERIODO:\s*\$?([\d,]+\.\d{2})/i);
      closingBalance = m ? parseAmount(m[1]) : 0;
    }

    // ── Parse individual transactions ─────────────────────────────────────
    const transactions = parseTransactionLines(txLines, openingBalance);
    if (transactions.length === 0) continue; // empty section (e.g. MIS METAS with $0)

    sections.push({
      productName,
      accountNumber,
      clabe: globalClabe,
      openingBalance,
      closingBalance,
      totalCredits,
      totalCharges,
      transactions,
    });
  }

  if (sections.length === 0) {
    throw new Error("No se encontraron movimientos en el PDF");
  }

  return sections.map((s) => ({
    account: {
      bankName:      "Santander",
      productName:   s.productName || "Cuenta Corriente",
      accountNumber: s.accountNumber || undefined,
      clabe:         s.clabe || undefined,
      currency:      "MXN",
      type:          "CHECKING" as const,
    },
    statement: {
      periodStart,
      periodEnd,
      cutDate:        periodEnd,
      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance,
      totalCharges:   s.totalCharges,
      totalCredits:   s.totalCredits,
      sourceFile:     `santander-cheques-${periodEnd}.pdf`,
    },
    transactions: s.transactions,
  }));
}

/**
 * Groups raw text lines into transaction blocks (each starts with a date),
 * then extracts amounts and description using running balance to determine
 * whether a transaction is a credit (abono) or charge (retiro).
 */
function parseTransactionLines(
  lines: string[],
  openingBalance: number
): ImportStatementPayload["transactions"] {
  // Group consecutive lines into blocks, each block starting with a date
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (DATE_RE.test(line)) {
      if (current.length > 0) blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  const transactions: ImportStatementPayload["transactions"] = [];
  let prevBalance = openingBalance;

  for (const block of blocks) {
    const fullText = block.join(" ");

    // Last amount = running balance; second-to-last = transaction amount
    const { text: withoutAmounts, amounts } = popTrailingAmounts(fullText, 2);
    if (amounts.length === 0) continue;

    const balance = amounts[amounts.length - 1];

    // Parse date (first token)
    const dateStr = fullText.match(/^\d{2}-[A-Z]{3}-\d{4}/i)?.[0] ?? "";
    let transactionDate: string;
    try {
      transactionDate = spanishDateToISO(dateStr);
    } catch {
      continue;
    }

    // Parse folio (7-digit number immediately after date)
    const afterDate = withoutAmounts.slice(dateStr.length).trimStart();
    const folioMatch = afterDate.match(/^(\d{7})\s+/);
    const rawFolio = folioMatch?.[1];
    const reference = rawFolio && rawFolio !== "0000000" ? rawFolio : undefined;
    const descOffset = folioMatch ? folioMatch[0].length : 0;
    const description = afterDate.slice(descOffset).trim() || "Sin descripción";

    // Direction via running balance (avoids column-order ambiguity)
    const delta = Math.round((balance - prevBalance) * 100) / 100;

    transactions.push({
      transactionDate,
      description,
      reference,
      chargeAmount:  delta < 0 ? Math.abs(delta) : undefined,
      creditAmount:  delta > 0 ? delta            : undefined,
      balance,
      rawOcrText:    fullText,
    });

    prevBalance = balance;
  }

  return transactions;
}
