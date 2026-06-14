import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import OpenAI from "openai";
import { z } from "zod";
import type { ImportStatementPayload } from "@/types/financial";

const execFileAsync = promisify(execFile);

// ── Model configuration (override via .env.local) ─────────────────────────────
// NOTE: set these to valid OpenAI model IDs that support Vision.
// Defaults assume models with Structured Outputs + Vision support.
const VISION_MODEL          = process.env.OPENAI_VISION_MODEL          ?? "gpt-5.4-mini";
const VISION_RETRY_MODEL    = process.env.OPENAI_VISION_RETRY_MODEL    ?? "gpt-5.5";
const LEGACY_FALLBACK_MODEL = process.env.OPENAI_LEGACY_FALLBACK_MODEL ?? "gpt-4o-mini";

// ── Validation thresholds ─────────────────────────────────────────────────────
const CONFIDENCE_THRESHOLD = 0.90;    // below this → retry
const TOTAL_TOLERANCE_PCT  = 0.01;    // 1 % tolerance for total matching
const TOTAL_TOLERANCE_ABS  = 10;      // or $10 MXN absolute, whichever is larger

const MAX_PAGES = 10;
const PDF_DPI   = 150;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape produced by the strict JSON schema (Structured Outputs). */
interface VisionRawResponse {
  confidence: number;
  account: {
    bankName:      string;
    productName:   string;
    accountNumber: string | null;
    cardNumber:    string | null;
    currency:      string;
    type:          string;
  };
  statement: {
    periodStart:    string;
    periodEnd:      string;
    cutDate:        string | null;
    openingBalance: number | null;
    closingBalance: number | null;
    totalCharges:   number | null;
    totalCredits:   number | null;
    sourceFile:     string;
  };
  transactions: Array<{
    transactionDate: string;
    description:     string;
    reference:       string | null;
    chargeAmount:    number | null;
    creditAmount:    number | null;
    balance:         number | null;
  }>;
}

interface ExtractionIssues {
  needsRetry:       boolean;
  reasons:          string[];
  invalidDateCount: number;
  invalidAmtCount:  number;
}

const VisionRawResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  account: z.object({
    bankName:      z.string(),
    productName:   z.string(),
    accountNumber: z.string().nullable(),
    cardNumber:    z.string().nullable(),
    currency:      z.string(),
    type:          z.string(),
  }).strict(),
  statement: z.object({
    periodStart:    z.string(),
    periodEnd:      z.string(),
    cutDate:        z.string().nullable(),
    openingBalance: z.number().nullable(),
    closingBalance: z.number().nullable(),
    totalCharges:   z.number().nullable(),
    totalCredits:   z.number().nullable(),
    sourceFile:     z.string(),
  }).strict(),
  transactions: z.array(z.object({
    transactionDate: z.string(),
    description:     z.string(),
    reference:       z.string().nullable(),
    chargeAmount:    z.number().nullable(),
    creditAmount:    z.number().nullable(),
    balance:         z.number().nullable(),
  }).strict()),
}).strict();

// ── Strict JSON Schema for Structured Outputs ─────────────────────────────────
// All object properties are required and additionalProperties is false,
// as mandated by OpenAI strict mode.

const STATEMENT_SCHEMA: { [key: string]: unknown } = {
  type: "object",
  additionalProperties: false,
  required: ["confidence", "account", "statement", "transactions"],
  properties: {
    confidence: {
      type: "number",
      description:
        "Self-reported extraction confidence 0.0–1.0. Use 1.0 only when every date, " +
        "amount, and description was clearly legible. Lower values trigger a re-check.",
    },
    account: {
      type: "object",
      additionalProperties: false,
      required: ["bankName", "productName", "accountNumber", "cardNumber", "currency", "type"],
      properties: {
        bankName:      { type: "string" },
        productName:   { type: "string" },
        accountNumber: { anyOf: [{ type: "string" }, { type: "null" }] },
        cardNumber:    { anyOf: [{ type: "string" }, { type: "null" }] },
        currency:      { type: "string" },
        type:          { type: "string", enum: ["CHECKING", "CREDIT"] },
      },
    },
    statement: {
      type: "object",
      additionalProperties: false,
      required: [
        "periodStart", "periodEnd", "cutDate",
        "openingBalance", "closingBalance",
        "totalCharges",  "totalCredits",  "sourceFile",
      ],
      properties: {
        periodStart:    { type: "string" },
        periodEnd:      { type: "string" },
        cutDate:        { anyOf: [{ type: "string" }, { type: "null" }] },
        openingBalance: { anyOf: [{ type: "number" }, { type: "null" }] },
        closingBalance: { anyOf: [{ type: "number" }, { type: "null" }] },
        totalCharges:   { anyOf: [{ type: "number" }, { type: "null" }] },
        totalCredits:   { anyOf: [{ type: "number" }, { type: "null" }] },
        sourceFile:     { type: "string" },
      },
    },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "transactionDate", "description", "reference",
          "chargeAmount",    "creditAmount", "balance",
        ],
        properties: {
          transactionDate: { type: "string" },
          description:     { type: "string" },
          reference:       { anyOf: [{ type: "string" }, { type: "null" }] },
          chargeAmount:    { anyOf: [{ type: "number" }, { type: "null" }] },
          creditAmount:    { anyOf: [{ type: "number" }, { type: "null" }] },
          balance:         { anyOf: [{ type: "number" }, { type: "null" }] },
        },
      },
    },
  },
};

// ── Error class ───────────────────────────────────────────────────────────────

export type VisionOcrErrorName =
  | "MISSING_OPENAI_API_KEY"
  | "PDFTOPPM_NOT_FOUND"
  | "OPENAI_MODEL_ERROR"
  | "OPENAI_SCHEMA_ERROR"
  | "NO_TRANSACTIONS_DETECTED"
  | "INVALID_OCR_PAYLOAD";

export class VisionOcrError extends Error {
  public readonly code: VisionOcrErrorName;

  constructor(
    message: string,
    code: VisionOcrErrorName,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = code;
    this.code = code;
    Object.setPrototypeOf(this, VisionOcrError.prototype);
  }
}

// ── Date / amount helpers ─────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04",
  MAY: "05", JUN: "06", JUL: "07", AGO: "08",
  SEP: "09", OCT: "10", NOV: "11", DIC: "12",
};

function toISO(raw: unknown): string | null {
  const d = String(raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const m = d.match(/^(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{4})$/i);
  if (!m) return null;
  const mm = MONTH_MAP[m[2].toUpperCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function toAnyNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function toPositiveNumber(v: unknown): number | null {
  const n = toAnyNumber(v);
  return n !== null && n > 0 ? n : null;
}

// ── PDF → PNG conversion ──────────────────────────────────────────────────────

async function assertPdftoppmAvailable(): Promise<void> {
  try {
    await execFileAsync("pdftoppm", ["-v"], { timeout: 5_000 });
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new VisionOcrError(
        "pdftoppm no está instalado en el servidor. Instala poppler-utils para procesar PDFs escaneados.",
        "PDFTOPPM_NOT_FOUND",
      );
    }

    throw new VisionOcrError(
      "pdftoppm no se pudo ejecutar correctamente. Verifica la instalación de poppler-utils.",
      "PDFTOPPM_NOT_FOUND",
      { command: "pdftoppm -v" },
    );
  }
}

/**
 * Renders each page of a PDF to a PNG buffer using pdftoppm (poppler-utils).
 * Converts up to MAX_PAGES pages at PDF_DPI resolution.
 */
export async function renderPdfToImages(buffer: Buffer): Promise<Buffer[]> {
  await assertPdftoppmAvailable();

  const tmpDir       = await fs.mkdtemp(path.join(os.tmpdir(), "stmt-ocr-"));
  const inputPath    = path.join(tmpDir, "input.pdf");
  const outputPrefix = path.join(tmpDir, "page");

  try {
    await fs.writeFile(inputPath, buffer);

    try {
      await execFileAsync(
        "pdftoppm",
        ["-r", String(PDF_DPI), "-png", "-l", String(MAX_PAGES), inputPath, outputPrefix],
        { timeout: 60_000 },
      );
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") {
        throw new VisionOcrError(
          "pdftoppm no está instalado en el servidor. Instala poppler-utils para procesar PDFs escaneados.",
          "PDFTOPPM_NOT_FOUND",
        );
      }
      throw new VisionOcrError(
        "No se pudo convertir el PDF escaneado a imágenes. Verifica que el PDF no esté protegido o corrupto.",
        "INVALID_OCR_PAYLOAD",
        { command: "pdftoppm", reason: "PDF_RENDER_ERROR" },
      );
    }

    const entries  = await fs.readdir(tmpDir);
    const pngFiles = entries
      .filter(f => f.startsWith("page") && f.endsWith(".png"))
      .sort((a, b) => {
        const na = parseInt(a.replace(/\D+/g, ""), 10);
        const nb = parseInt(b.replace(/\D+/g, ""), 10);
        return na - nb;
      });

    if (pngFiles.length === 0) {
      throw new VisionOcrError(
        "No se pudo extraer ninguna página del PDF escaneado.",
        "INVALID_OCR_PAYLOAD",
        { reason: "NO_PAGES" },
      );
    }

    return Promise.all(pngFiles.map(f => fs.readFile(path.join(tmpDir, f))));
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `Eres un extractor especializado en estados de cuenta bancarios mexicanos de Santander. ` +
  `Extraes movimientos financieros con precisión absoluta desde imágenes. ` +
  `Siempre reporta tu confianza real en el campo "confidence" (0.0–1.0): ` +
  `reduce confidence si algún número fue difícil de leer, si las páginas estaban inclinadas, ` +
  `o si los totales no cuadran exactamente con la suma de los movimientos.`;

function buildUserPrompt(filename: string): string {
  return `Analiza las imágenes de un estado de cuenta Santander México. Archivo: ${filename}

IDENTIFICA EL TIPO DE ESTADO DE CUENTA:

A) CUENTA CORRIENTE / NÓMINA — tabla con columnas FECHA | FOLIO | DESCRIPCIÓN | DEPÓSITO | RETIRO | SALDO
   - type: "CHECKING"
   - DEPÓSITO → creditAmount (ingreso/abono)
   - RETIRO   → chargeAmount (egreso/cargo)
   - Folio de 7 dígitos (si ≠ "0000000") → campo "reference"

B) TARJETA DE CRÉDITO (AMERICAN EXPRESS, GOLD, etc.) — tabla "CARGOS, ABONOS Y COMPRAS REGULARES"
   - type: "CREDIT"
   - Signo "+" antes del monto → chargeAmount (cargo cobrado al cliente)
   - Signo "−" o "-" antes del monto → creditAmount (pago/abono del cliente)
   - OMITE la tabla "COMPRAS Y CARGOS DIFERIDOS A MESES" — no la incluyas en transactions
   - La mensualidad de diferidos SÍ aparece en la tabla principal como cargo regular — inclúyela solo ahí

EXTRACCIÓN DE DATOS:
- Fechas en ISO yyyy-mm-dd (06-ABR-2026 → 2026-04-06, 06-Mar-2026 → 2026-03-06)
- Montos: decimales positivos sin comas ni signos (1,200.50 → 1200.50)
- Cada transacción tiene chargeAmount CON valor ≥ 0.01 O creditAmount CON valor ≥ 0.01 — el otro null
- Incluye TODOS los movimientos de la sección principal en orden cronológico sin omitir ninguno
- Para cuenta corriente: openingBalance = saldo período anterior, closingBalance = saldo final del período
- Para tarjeta:          openingBalance = adeudo período anterior, closingBalance = pago para no generar intereses
- accountNumber: número completo de cuenta corriente (ej: "60-59271120-6"), null para tarjetas
- cardNumber: solo los últimos 4 dígitos para tarjetas de crédito, null para cuentas corrientes
- description: máximo 150 caracteres
- NO incluyas en el JSON: nombre del titular, domicilio, RFC, CLABE, número completo de tarjeta
- NO dupliques transacciones

CONFIDENCE: reporta < 0.90 si hay texto borroso, dígitos ambiguos, o si los totales extraídos
no coinciden exactamente con los totales impresos en el documento.`;
}

function buildRetryPrompt(filename: string, reasons: string[], prev: VisionRawResponse): string {
  const issueList = reasons.map(r => `  - ${r}`).join("\n");
  return `${buildUserPrompt(filename)}

INTENTO ANTERIOR CON PROBLEMAS - revisa con más cuidado:
${issueList}

El intento previo extrajo ${prev.transactions.length} transacción(es) con confidence ${(prev.confidence * 100).toFixed(0)}%.
Examina cada página detenidamente. Verifica que la suma de cargos y abonos coincida
exactamente con los totales impresos. Corrige cualquier fecha o monto ilegible.`;
}

// ── Image content parts ───────────────────────────────────────────────────────

function buildImageParts(
  images: Buffer[],
): OpenAI.Chat.Completions.ChatCompletionContentPartImage[] {
  return images.map(img => ({
    type:      "image_url" as const,
    image_url: {
      url:    `data:image/png;base64,${img.toString("base64")}`,
      detail: "high" as const,
    },
  }));
}

// ── Model callers ─────────────────────────────────────────────────────────────

/** Calls model with Structured Outputs (json_schema, strict). */
async function callWithStructuredOutputs(
  client:     OpenAI,
  model:      string,
  userPrompt: string,
  imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[],
): Promise<VisionRawResponse> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: 8192,
    response_format: {
      type:        "json_schema",
      json_schema: {
        name:   "bank_statement_extraction",
        strict: true,
        schema: STATEMENT_SCHEMA,
      },
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role:    "user",
        content: [
          { type: "text" as const, text: userPrompt },
          ...imageParts,
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new VisionOcrError(
      "El modelo no devolvió contenido para el OCR del estado de cuenta.",
      "OPENAI_SCHEMA_ERROR",
      { model, reason: "EMPTY_RESPONSE" },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VisionOcrError(
      "El modelo devolvió JSON malformado para el OCR del estado de cuenta.",
      "OPENAI_SCHEMA_ERROR",
      { model, reason: "MALFORMED_JSON" },
    );
  }

  return validateRawResponse(parsed, model);
}

/**
 * Calls model with legacy json_object mode (for models that don't support json_schema).
 * Injects a default confidence of 0.75 when the model omits it.
 */
async function callWithLegacyMode(
  client:     OpenAI,
  model:      string,
  userPrompt: string,
  imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[],
): Promise<VisionRawResponse> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role:    "user",
        content: [
          { type: "text" as const, text: userPrompt },
          ...imageParts,
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new VisionOcrError(
      "El modelo no devolvió contenido para el OCR del estado de cuenta.",
      "OPENAI_SCHEMA_ERROR",
      { model, reason: "EMPTY_RESPONSE" },
    );
  }

  const jsonStr = raw.startsWith("{") ? raw : (raw.match(/\{[\s\S]+\}/)?.[0] ?? "");
  if (!jsonStr) {
    throw new VisionOcrError(
      "No se encontró JSON válido en la respuesta del modelo.",
      "OPENAI_SCHEMA_ERROR",
      { model, reason: "INVALID_JSON" },
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new VisionOcrError(
      "El modelo devolvió JSON malformado para el OCR del estado de cuenta.",
      "OPENAI_SCHEMA_ERROR",
      { model, reason: "MALFORMED_JSON" },
    );
  }

  // Legacy models don't self-report confidence — use conservative default
  if (typeof parsed.confidence !== "number") {
    parsed.confidence = 0.75;
  }

  return validateRawResponse(parsed, model);
}

function validateRawResponse(raw: unknown, model: string): VisionRawResponse {
  const parsed = VisionRawResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new VisionOcrError(
      "El modelo devolvió datos con estructura inválida para el estado de cuenta.",
      "OPENAI_SCHEMA_ERROR",
      {
        model,
        issueCount: parsed.error.issues.length,
        fields: [...new Set(parsed.error.issues.map(issue => issue.path.join(".")).filter(Boolean))].slice(0, 8),
      },
    );
  }

  return parsed.data;
}

// ── Validation ────────────────────────────────────────────────────────────────

function countInvalidTransactionDates(raw: VisionRawResponse): number {
  return raw.transactions.filter(t => toISO(t.transactionDate) === null).length;
}

function countInvalidTransactionAmounts(raw: VisionRawResponse): number {
  return raw.transactions.filter(
    t =>
      (t.chargeAmount === null || t.chargeAmount <= 0) &&
      (t.creditAmount === null || t.creditAmount <= 0),
  ).length;
}

/**
 * Checks the four retry conditions:
 *   1. confidence < CONFIDENCE_THRESHOLD
 *   2. transactions.length === 0
 *   3. extracted totals don't match visible statement totals (within tolerance)
 *   4. invalid dates or amounts found in the raw response
 */
function validateExtraction(
  raw:        VisionRawResponse,
  normalized: ImportStatementPayload,
): ExtractionIssues {
  const reasons: string[] = [];

  // ── 1. Self-reported confidence ───────────────────────────────────────────
  if (raw.confidence < CONFIDENCE_THRESHOLD) {
    reasons.push(
      `confianza reportada ${(raw.confidence * 100).toFixed(0)}% < umbral ${CONFIDENCE_THRESHOLD * 100}%`,
    );
  }

  // ── 2. No transactions extracted ─────────────────────────────────────────
  if (normalized.transactions.length === 0) {
    reasons.push("no se extrajeron transacciones");
  }

  // ── 3. Invalid dates in raw response (failed toISO) ───────────────────────
  const invalidDateCount = countInvalidTransactionDates(raw);
  if (invalidDateCount > 0) {
    reasons.push(`${invalidDateCount} fecha(s) con formato inválido`);
  }

  // ── 4. Invalid amounts (row has no positive charge/credit) ────────────────
  const invalidAmtCount = countInvalidTransactionAmounts(raw);
  if (invalidAmtCount > 0) {
    reasons.push(`${invalidAmtCount} transacción(es) sin monto válido`);
  }

  // ── 5. Total charges mismatch ─────────────────────────────────────────────
  if (normalized.statement.totalCharges != null && normalized.transactions.length > 0) {
    const sumCharges = normalized.transactions.reduce((s, t) => s + (t.chargeAmount ?? 0), 0);
    const tolerance  = Math.max(
      normalized.statement.totalCharges * TOTAL_TOLERANCE_PCT,
      TOTAL_TOLERANCE_ABS,
    );
    const diff = Math.abs(sumCharges - normalized.statement.totalCharges);
    if (diff > tolerance) {
      reasons.push(
        `cargos no cuadran: suma $${sumCharges.toFixed(2)} ≠ total $${normalized.statement.totalCharges.toFixed(2)} (diff $${diff.toFixed(2)})`,
      );
    }
  }

  // ── 6. Total credits mismatch ─────────────────────────────────────────────
  if (normalized.statement.totalCredits != null && normalized.transactions.length > 0) {
    const sumCredits = normalized.transactions.reduce((s, t) => s + (t.creditAmount ?? 0), 0);
    const tolerance  = Math.max(
      normalized.statement.totalCredits * TOTAL_TOLERANCE_PCT,
      TOTAL_TOLERANCE_ABS,
    );
    const diff = Math.abs(sumCredits - normalized.statement.totalCredits);
    if (diff > tolerance) {
      reasons.push(
        `abonos no cuadran: suma $${sumCredits.toFixed(2)} ≠ total $${normalized.statement.totalCredits.toFixed(2)} (diff $${diff.toFixed(2)})`,
      );
    }
  }

  return {
    needsRetry:       reasons.length > 0,
    reasons,
    invalidDateCount,
    invalidAmtCount,
  };
}

function buildNormalizationRetryIssues(
  raw: VisionRawResponse,
  err: unknown,
): ExtractionIssues | null {
  if (
    !(err instanceof VisionOcrError) ||
    err.code !== "INVALID_OCR_PAYLOAD" ||
    err.details.reason !== "INVALID_PERIOD"
  ) return null;

  return {
    needsRetry:       true,
    reasons:          [`fechas del período inválidas: ${err.message}`],
    invalidDateCount: countInvalidTransactionDates(raw) + 1,
    invalidAmtCount:  countInvalidTransactionAmounts(raw),
  };
}

function normalizeOrRetryIssues(
  raw:      VisionRawResponse,
  filename: string,
): { normalized: ImportStatementPayload | null; issues: ExtractionIssues } {
  try {
    const normalized = normalizePayload(raw, filename);
    return { normalized, issues: validateExtraction(raw, normalized) };
  } catch (err) {
    const retryIssues = buildNormalizationRetryIssues(raw, err);
    if (retryIssues) {
      return { normalized: null, issues: retryIssues };
    }
    throw err;
  }
}

// ── Payload normalization ─────────────────────────────────────────────────────

function normalizePayload(raw: VisionRawResponse, filename: string): ImportStatementPayload {
  const { account: acct, statement: stmt, transactions: rawTxns } = raw;

  // Normalize account type — guard against unexpected values
  const rawType = String(acct.type ?? "").toUpperCase();
  const accountType: "CHECKING" | "CREDIT" =
    rawType === "CREDIT" || rawType.includes("CRÉDITO") || rawType.includes("CREDITO")
      ? "CREDIT"
      : "CHECKING";

  // Validate period dates
  const periodStart = toISO(stmt.periodStart);
  const periodEnd   = toISO(stmt.periodEnd);
  if (!periodStart || !periodEnd) {
    throw new VisionOcrError(
      "No se encontró el período del estado de cuenta en el PDF",
      "INVALID_OCR_PAYLOAD",
      { reason: "INVALID_PERIOD" },
    );
  }

  // Normalize transactions with in-batch dedup
  const seen         = new Set<string>();
  const transactions: ImportStatementPayload["transactions"] = [];

  for (const t of rawTxns) {
    const transactionDate = toISO(t.transactionDate);
    if (!transactionDate) continue;

    const description  = sanitizeStatementText(t.description, 150) || "Sin descripción";
    const chargeAmount = toPositiveNumber(t.chargeAmount);
    const creditAmount = toPositiveNumber(t.creditAmount);
    const balance      = toAnyNumber(t.balance);
    const reference    = sanitizeReference(t.reference);

    // Skip rows carrying no financial data
    if (chargeAmount === null && creditAmount === null) continue;

    // Dedup within this batch by natural key
    const key = `${transactionDate}|${description.toLowerCase()}|${chargeAmount ?? ""}|${creditAmount ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    transactions.push({
      transactionDate,
      description,
      reference,
      chargeAmount:  chargeAmount  ?? undefined,
      creditAmount:  creditAmount  ?? undefined,
      balance:       balance       ?? undefined,
    });
  }

  return {
    account: {
      bankName:      sanitizeStatementText(acct.bankName, 80)    || "Santander",
      productName:   sanitizeStatementText(acct.productName, 80) || "Cuenta Bancaria",
      accountNumber: accountType === "CHECKING" ? sanitizeAccountNumber(acct.accountNumber) : undefined,
      cardNumber:    accountType === "CREDIT" ? last4Digits(acct.cardNumber) : undefined,
      currency:      sanitizeStatementText(acct.currency, 8) || "MXN",
      type:          accountType,
    },
    statement: {
      periodStart,
      periodEnd,
      cutDate:        toISO(stmt.cutDate) ?? periodEnd,
      openingBalance: toAnyNumber(stmt.openingBalance)    ?? undefined,
      closingBalance: toAnyNumber(stmt.closingBalance)    ?? undefined,
      totalCharges:   toPositiveNumber(stmt.totalCharges) ?? undefined,
      totalCredits:   toPositiveNumber(stmt.totalCredits) ?? undefined,
      sourceFile:     filename,
    },
    transactions,
  };
}

function sanitizeStatementText(raw: unknown, maxLength: number): string {
  return String(raw ?? "")
    .replace(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/gi, "[RFC]")
    .replace(/\b\d{18}\b/g, "[CLABE]")
    .replace(/\b\d{13,19}\b/g, (match) => `****${match.slice(-4)}`)
    .slice(0, maxLength)
    .trim();
}

function sanitizeReference(raw: unknown): string | undefined {
  const value = sanitizeStatementText(raw, 80);
  if (!value || value.includes("[CLABE]")) return undefined;
  return value;
}

function sanitizeAccountNumber(raw: unknown): string | undefined {
  const value = String(raw ?? "").trim();
  const digits = value.replace(/\D/g, "");
  if (!value || digits.length === 18 || digits.length >= 13) return undefined;
  return value.slice(0, 40);
}

function last4Digits(raw: unknown): string | undefined {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 4) return undefined;
  return digits.slice(-4);
}

// ── Model error detection ─────────────────────────────────────────────────────

/**
 * Returns true when the API error means the model is unavailable or doesn't
 * support Structured Outputs (json_schema). The caller falls back to the legacy
 * json_object path in that case.
 */
type OpenAIErrorLike = {
  status?: unknown;
  code?: unknown;
  type?: unknown;
  param?: unknown;
  requestID?: unknown;
  error?: { code?: unknown; type?: unknown; param?: unknown; message?: unknown };
};

function getOpenAIErrorMeta(err: unknown): Record<string, unknown> {
  const apiErr = err as OpenAIErrorLike;

  return {
    status:    apiErr.status,
    code:      apiErr.code ?? apiErr.error?.code,
    type:      apiErr.type ?? apiErr.error?.type,
    param:     apiErr.param ?? apiErr.error?.param,
    requestID: apiErr.requestID,
  };
}

function getOpenAIErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.toLowerCase();
  return String(err ?? "").toLowerCase();
}

function isOpenAIError(err: unknown): boolean {
  const maybe = err as { status?: unknown; error?: unknown };
  return err instanceof OpenAI.APIError || typeof maybe.status === "number" || Boolean(maybe.error);
}

function isModelUnavailable(err: unknown): boolean {
  const meta = getOpenAIErrorMeta(err);
  const msg = getOpenAIErrorMessage(err);
  return (
    meta.status === 404 ||
    String(meta.code ?? "").includes("model") ||
    msg.includes("does not exist") ||
    msg.includes("model_not_found") ||
    msg.includes("model not found")
  );
}

function isSchemaIncompatible(err: unknown): boolean {
  const meta = getOpenAIErrorMeta(err);
  const msg = getOpenAIErrorMessage(err);
  if (meta.status !== 400) return false;
  return (
    msg.includes("json_schema") ||
    msg.includes("response_format") ||
    msg.includes("schema") ||
    msg.includes("strict") ||
    msg.includes("additionalproperties")
  );
}

function toOpenAIModelError(err: unknown, model: string): VisionOcrError {
  return new VisionOcrError(
    "OpenAI no pudo procesar el PDF escaneado. Verifica el modelo configurado o intenta de nuevo.",
    "OPENAI_MODEL_ERROR",
    { model, ...getOpenAIErrorMeta(err) },
  );
}

async function callStructuredOrLegacyFallback(
  client: OpenAI,
  model: string,
  userPrompt: string,
  imageParts: OpenAI.Chat.Completions.ChatCompletionContentPartImage[],
): Promise<{ raw: VisionRawResponse; model: string; mode: "json_schema" | "json_object" }> {
  try {
    return {
      raw: await callWithStructuredOutputs(client, model, userPrompt, imageParts),
      model,
      mode: "json_schema",
    };
  } catch (err) {
    if (!isModelUnavailable(err) && !isSchemaIncompatible(err)) {
      if (isOpenAIError(err)) throw toOpenAIModelError(err, model);
      throw err;
    }

    console.warn("[statement-import] vision_ocr_model_fallback", {
      unavailableModel: model,
      fallbackModel:    LEGACY_FALLBACK_MODEL,
      reason:           isModelUnavailable(err) ? "MODEL_UNAVAILABLE" : "SCHEMA_INCOMPATIBLE",
      ...getOpenAIErrorMeta(err),
    });

    try {
      return {
        raw: await callWithLegacyMode(client, LEGACY_FALLBACK_MODEL, userPrompt, imageParts),
        model: LEGACY_FALLBACK_MODEL,
        mode: "json_object",
      };
    } catch (fallbackErr) {
      if (fallbackErr instanceof VisionOcrError) throw fallbackErr;
      if (isOpenAIError(fallbackErr)) throw toOpenAIModelError(fallbackErr, LEGACY_FALLBACK_MODEL);
      throw fallbackErr;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses a scanned PDF bank statement using OpenAI Vision.
 *
 * Strategy:
 *   1. VISION_MODEL + Structured Outputs (json_schema strict)
 *   2. Validate against 4 quality conditions (confidence, txn count, date/amount validity, totals)
 *   3. If any condition fails → retry with VISION_RETRY_MODEL + Structured Outputs + issue context
 *   4. If primary or retry model is unavailable / incompatible → LEGACY_FALLBACK_MODEL + json_object
 *   5. After retry, return best result; throw NO_TRANSACTIONS_DETECTED if no rows are detected
 *
 * Throws VisionOcrError with typed `code`:
 *   MISSING_OPENAI_API_KEY → 503   PDFTOPPM_NOT_FOUND       → 503
 *   OPENAI_MODEL_ERROR     → 502   OPENAI_SCHEMA_ERROR      → 422
 *   NO_TRANSACTIONS_DETECTED / INVALID_OCR_PAYLOAD          → 422
 */
export async function parseStatementWithVision(
  buffer:   Buffer,
  filename: string,
): Promise<ImportStatementPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new VisionOcrError(
      "OPENAI_API_KEY no está configurada en el servidor para procesar PDFs escaneados.",
      "MISSING_OPENAI_API_KEY",
    );
  }

  const images     = await renderPdfToImages(buffer);
  const imageParts = buildImageParts(images);
  const client     = new OpenAI({ apiKey });

  console.info("[statement-import] vision_ocr_started", {
    pages: images.length,
    model: VISION_MODEL,
  });

  // ── Attempt 1: primary model with Structured Outputs ─────────────────────
  let primaryRaw:  VisionRawResponse;
  let primaryNorm: ImportStatementPayload | null;
  let issues:      ExtractionIssues;
  let attempt1Model = VISION_MODEL;

  try {
    const attempt = await callStructuredOrLegacyFallback(client, VISION_MODEL, buildUserPrompt(filename), imageParts);
    primaryRaw = attempt.raw;
    attempt1Model = attempt.model;
    const result = normalizeOrRetryIssues(primaryRaw, filename);
    primaryNorm = result.normalized;
    issues      = result.issues;
  } catch (err) {
    if (err instanceof VisionOcrError) throw err;
    if (isOpenAIError(err)) throw toOpenAIModelError(err, VISION_MODEL);
    throw err;
  }

  // ── Return early if primary passes all checks ─────────────────────────────
  if (!issues.needsRetry) {
    if (!primaryNorm) {
      throw new VisionOcrError(
        "No se pudo normalizar el estado de cuenta escaneado",
        "INVALID_OCR_PAYLOAD",
        { reason: "INVALID_PERIOD" },
      );
    }
    console.info("[statement-import] vision_ocr_success", {
      model:        attempt1Model,
      transactions: primaryNorm.transactions.length,
      confidence:   primaryRaw.confidence,
      accountType:  primaryNorm.account.type,
    });
    return primaryNorm;
  }

  // ── Attempt 2: retry with more capable model ──────────────────────────────
  const retryModel = VISION_RETRY_MODEL;

  console.warn("[statement-import] vision_ocr_retry", {
    primaryModel: attempt1Model,
    retryModel,
    reasonCount:  issues.reasons.length,
    invalidDates: issues.invalidDateCount,
    invalidAmts:  issues.invalidAmtCount,
  });

  let retryNorm: ImportStatementPayload;

  try {
    const retryPrompt = buildRetryPrompt(filename, issues.reasons, primaryRaw);
    const retryAttempt = await callStructuredOrLegacyFallback(client, retryModel, retryPrompt, imageParts);
    const retryRaw     = retryAttempt.raw;

    retryNorm = normalizePayload(retryRaw, filename);

    const retryIssues = validateExtraction(retryRaw, retryNorm);
    console.info("[statement-import] vision_ocr_success", {
      model:         retryAttempt.model,
      transactions:  retryNorm.transactions.length,
      confidence:    retryRaw.confidence,
      accountType:   retryNorm.account.type,
      residualIssueCount: retryIssues.reasons.length,
    });
  } catch (err) {
    if (err instanceof VisionOcrError) throw err;
    if (isOpenAIError(err)) throw toOpenAIModelError(err, retryModel);
    throw err;
  }

  // Prefer retry result; fall back to primary if retry produced nothing
  if (retryNorm.transactions.length === 0) {
    if (primaryNorm && primaryNorm.transactions.length > 0) return primaryNorm;
    throw new VisionOcrError(
      "No se encontraron transacciones en el estado de cuenta escaneado",
      "NO_TRANSACTIONS_DETECTED",
    );
  }

  return retryNorm;
}
