import type { ImportStatementPayload } from "@/types/financial";

const MONTH_MAP: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04",
  MAY: "05", JUN: "06", JUL: "07", AGO: "08",
  SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

function spanishDateToISO(d: string): string | null {
  const m = d.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/i);
  if (!m) return null;
  const mm = MONTH_MAP[m[2].toUpperCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/**
 * Quick detection for Santander credit card statements.
 * The key marker "CARGOS, ABONOS Y COMPRAS REGULARES" only appears on credit card
 * statements — checking/nómina accounts use "DEPOSITO/RETIRO" column headers instead.
 */
export function isSantanderCreditPDF(text: string): boolean {
  const norm = normalize(text);
  return (
    norm.includes("SANTANDER") &&
    norm.includes("CARGOS, ABONOS Y COMPRAS REGULARES") &&
    (norm.includes("NUMERO DE TARJETA") || norm.includes("TARJETA TITULAR"))
  );
}

// Matches a full transaction line:
// DD-Mon-YYYY  DD-Mon-YYYY  DESCRIPTION [REFERENCE]  +/-  $X,XXX.XX
const TXN_RE =
  /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\+\-])\s*\$?([\d,]+\.\d{2})\s*$/;

// Short authorization codes appended to description:
// ISD 950921HE5 | CPA 180810PH5 | TPT 890516JP5 | ANE 140618P37
const REF_RE = /\s+([A-Z]{2,4}\s+[A-Z0-9]{5,12})\s*$/;

// FX notation embedded in description: "20.00 USD TC 17.5415" — strip before ref extraction
const FX_RE = /\s+[\d,]+\.\d+\s+[A-Z]{3}\s+TC\s+[\d.]+\s*$/;

export function parseSantanderCreditPDF(
  text: string,
  sourceFile: string,
): ImportStatementPayload {
  // ── 1. Period ─────────────────────────────────────────────────────────────────
  const periodMatch = text.match(
    /[Pp]er[ií]odo:?\s+(\d{2}-[A-Za-z]{3}-\d{4})\s+al?\s+(\d{2}-[A-Za-z]{3}-\d{4})/i,
  );
  const periodStart = periodMatch ? spanishDateToISO(periodMatch[1]) : null;
  const periodEnd   = periodMatch ? spanishDateToISO(periodMatch[2]) : null;
  if (!periodStart || !periodEnd) {
    throw new Error("No se encontró el período del estado de cuenta en el PDF");
  }

  // ── 2. Cut date ───────────────────────────────────────────────────────────────
  const cutMatch = text.match(/[Ff]echa\s+de\s+corte:?\s+(\d{2}-[A-Za-z]{3}-\d{4})/i);
  const cutDate  = cutMatch ? (spanishDateToISO(cutMatch[1]) ?? periodEnd) : periodEnd;

  // ── 3. Card number (last 4 digits) ────────────────────────────────────────────
  const cardMatch  = text.match(/[Nn][uú]mero\s+de\s+tarjeta:?\s*([\d\s]+\d)/i);
  const rawCard    = cardMatch ? cardMatch[1].replace(/\s/g, "") : null;
  const cardNumber = rawCard ? rawCard.slice(-4) : undefined;

  // ── 4. Product name ───────────────────────────────────────────────────────────
  // "Denominación y categoría de la tarjeta: ORO"
  const denomMatch  = text.match(
    /[Dd]enominaci[oó]n\s+y\s+categor[ií]a\s+de\s+la\s+tarjeta:?\s*([^\n]+)/i,
  );
  const rawProduct  = denomMatch ? denomMatch[1].trim() : "";
  // Normalize: remove trailing superscript numbers/symbols
  const productName = rawProduct.replace(/[²³⁴\d]+$/, "").trim() || "Tarjeta de Crédito";

  // ── 5. Balances ───────────────────────────────────────────────────────────────
  const openMatch = text.match(
    /[Aa]deudo\s+del\s+per[ií]odo\s+anterior\s*=?\s*\$?([\d,]+\.\d{2})/i,
  );
  const openingBalance = openMatch ? parseAmount(openMatch[1]) : undefined;

  const closeMatch = text.match(
    /[Pp]ago\s+para\s+no\s+generar\s+intereses[²2]?\s*=?\s*\$?([\d,]+\.\d{2})/i,
  );
  const closingBalance = closeMatch ? parseAmount(closeMatch[1]) : undefined;

  // ── 6. Find the regular transactions section ──────────────────────────────────
  // We only want "CARGOS, ABONOS Y COMPRAS REGULARES (NO A MESES)".
  // We deliberately skip "COMPRAS Y CARGOS DIFERIDOS A MESES" — those installment
  // rows represent the full deferred balance, not the current-period charge.
  const normText      = normalize(text);
  const sectionMarker = "CARGOS, ABONOS Y COMPRAS REGULARES";
  const sectionIdx    = normText.indexOf(sectionMarker);
  if (sectionIdx === -1) {
    throw new Error("No se encontró la sección de movimientos en el PDF");
  }

  // Slice from the section header onward and find the end boundary
  let sectionText = text.slice(sectionIdx);
  const normSection = normalize(sectionText);
  const endMarkers  = ["ATENCION DE QUEJAS", "NOTAS ACLARATORIAS", "GLOSARIO DE TERMINOS"];
  let endIdx = sectionText.length;
  for (const marker of endMarkers) {
    const idx = normSection.indexOf(marker);
    if (idx !== -1 && idx < endIdx) endIdx = idx;
  }
  sectionText = sectionText.slice(0, endIdx);

  // ── 7. Extract totals from the section footer ─────────────────────────────────
  const totalChargesMatch = sectionText.match(/[Tt]otal\s+cargos\s*\+?\s*\$?([\d,]+\.\d{2})/i);
  const totalCreditsMatch = sectionText.match(/[Tt]otal\s+abonos\s*\-?\s*\$?([\d,]+\.\d{2})/i);
  const totalCharges = totalChargesMatch ? parseAmount(totalChargesMatch[1]) : undefined;
  const totalCredits = totalCreditsMatch ? parseAmount(totalCreditsMatch[1]) : undefined;

  // ── 8. Parse transaction lines ────────────────────────────────────────────────
  const transactions: ImportStatementPayload["transactions"] = [];
  const seen = new Set<string>();

  for (const rawLine of sectionText.split("\n")) {
    const line  = rawLine.trim();
    const match = TXN_RE.exec(line);
    if (!match) continue;

    // Use "Fecha de cargo" (col 2) as transactionDate — this is what the bank charges
    const transactionDate = spanishDateToISO(match[2]);
    if (!transactionDate) continue;

    const sign      = match[4] as "+" | "-";
    const amount    = parseAmount(match[5]);
    if (amount <= 0) continue;

    // Clean description: strip FX notation first, then extract reference
    let desc = match[3].replace(FX_RE, "").trim();

    let reference: string | undefined;
    const refMatch = REF_RE.exec(desc);
    if (refMatch) {
      reference = refMatch[1].trim();
      desc      = desc.slice(0, refMatch.index).trim();
    }

    const description = desc.slice(0, 150).trim() || "Sin descripción";

    // In Santander credit card statements:
    //   "+" → cargo (charge billed to customer)   → chargeAmount
    //   "-" → abono (payment/credit from customer) → creditAmount
    const chargeAmount = sign === "+" ? amount : undefined;
    const creditAmount = sign === "-" ? amount : undefined;

    const key = `${transactionDate}|${description.toLowerCase()}|${chargeAmount ?? ""}|${creditAmount ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    transactions.push({ transactionDate, description, reference, chargeAmount, creditAmount });
  }

  if (transactions.length === 0) {
    throw new Error(
      "No se encontraron transacciones en el estado de cuenta. " +
      "Verifica que el PDF no esté protegido o sea un estado de cuenta Santander válido.",
    );
  }

  return {
    account: {
      bankName:    "Santander",
      productName,
      cardNumber,
      currency:    "MXN",
      type:        "CREDIT",
    },
    statement: {
      periodStart,
      periodEnd,
      cutDate,
      openingBalance,
      closingBalance,
      totalCharges,
      totalCredits,
      sourceFile,
    },
    transactions,
  };
}
