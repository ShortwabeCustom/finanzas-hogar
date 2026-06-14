import OpenAI from "openai";
import type { ImportStatementPayload } from "@/types/financial";

const MAX_TEXT_CHARS = 16_000; // ~4k tokens — enough for a full bank statement

const SYSTEM_PROMPT = `Eres un extractor de estados de cuenta bancarios mexicanos.
Tu única tarea es analizar texto de un PDF y devolver un JSON estructurado.
No agregues explicaciones, comentarios ni markdown. Solo devuelve el objeto JSON.`;

const buildUserPrompt = (text: string, filename: string) => `
Analiza el siguiente texto de estado de cuenta bancario y extrae los movimientos.
El archivo se llama: ${filename}

TEXTO DEL PDF:
${text.slice(0, MAX_TEXT_CHARS)}

Devuelve ÚNICAMENTE un objeto JSON con exactamente esta estructura (sin bloques de código, sin texto extra):
{
  "account": {
    "bankName": "Santander",
    "productName": "Cuenta Corriente",
    "accountNumber": null,
    "clabe": null,
    "cardNumber": null,
    "currency": "MXN",
    "type": "CHECKING"
  },
  "statement": {
    "periodStart": "2026-01-01",
    "periodEnd": "2026-01-31",
    "cutDate": null,
    "openingBalance": 1000.00,
    "closingBalance": 2500.00,
    "totalCharges": 500.00,
    "totalCredits": 2000.00,
    "sourceFile": "${filename}"
  },
  "transactions": [
    {
      "transactionDate": "2026-01-15",
      "description": "COMPRA EN COMERCIO",
      "reference": null,
      "chargeAmount": 150.00,
      "creditAmount": null,
      "balance": 850.00
    }
  ]
}

Reglas OBLIGATORIAS:
- Reemplaza TODOS los valores del ejemplo anterior con datos reales del PDF — NO copies los valores de ejemplo
- "type": usa exactamente "CHECKING" para cuentas de débito/corriente/nómina, o "CREDIT" para tarjetas de crédito
- "bankName": nombre real del banco tal como aparece en el estado de cuenta
- Los montos son números sin comas ni signos (1200.50, no "1,200.50" ni "-150.00")
- Cada transacción tiene chargeAmount O creditAmount, nunca ambos (el otro debe ser null)
- Si es RETIRO/CARGO/COMPRA → chargeAmount tiene el monto, creditAmount es null
- Si es DEPÓSITO/ABONO/PAGO → creditAmount tiene el monto, chargeAmount es null
- Incluye TODOS los movimientos del estado de cuenta sin omitir ninguno
- Si no puedes leer algún campo, usa null (nunca omitas la clave)
`.trim();

/**
 * Falls back to OpenAI when the PDF format is not recognized by any
 * in-process parser. Extracts structured transaction data from plain text
 * (previously extracted by pdf-parse).
 *
 * Requires OPENAI_API_KEY environment variable.
 */
export async function parseWithAI(
  pdfText: string,
  filename: string
): Promise<ImportStatementPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está configurada — no se puede usar el parser de IA");
  }

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 4096,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(pdfText, filename) },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) {
    throw new Error("El modelo de IA no devolvió contenido");
  }

  // response_format: json_object guarantees valid JSON, but tolerate code fences just in case
  const jsonStr = raw.startsWith("{") ? raw : (raw.match(/\{[\s\S]+\}/)?.[0] ?? "");
  if (!jsonStr) {
    throw new Error("El modelo de IA no devolvió un JSON válido");
  }

  let payload: ImportStatementPayload;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error("El modelo de IA devolvió un JSON mal formado");
  }

  if (!payload.account || !payload.statement || !Array.isArray(payload.transactions)) {
    throw new Error("El JSON del modelo de IA no tiene la estructura esperada");
  }

  // Detect when the model returned placeholder/example text instead of real data
  const bankName = String(payload.account.bankName ?? "");
  if (
    bankName === "nombre del banco" ||
    bankName === "Santander" && payload.account.productName === "Cuenta Corriente" &&
      payload.transactions.length === 1 &&
      payload.transactions[0].description === "COMPRA EN COMERCIO"
  ) {
    throw new Error(
      "El PDF no pudo ser interpretado correctamente. " +
      "Verifica que no esté protegido con contraseña y que sea un estado de cuenta legible."
    );
  }

  // Normalize type field — guards against values like "CHECKING o CREDIT" returned by older prompts
  const rawType = String(payload.account.type ?? "").toUpperCase();
  if (rawType === "CHECKING" || rawType === "CREDIT") {
    payload.account.type = rawType as "CHECKING" | "CREDIT";
  } else if (rawType.includes("CREDIT") || rawType.includes("CRÉDITO") || rawType.includes("CREDITO")) {
    payload.account.type = "CREDIT";
  } else {
    payload.account.type = "CHECKING";
  }

  return payload;
}

/**
 * Extracts raw text from a PDF buffer using pdf-parse.
 * Used both by ai-fallback and as a prerequisite step before calling parseWithAI.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse v2: class-based API, dynamic import keeps it out of the Turbopack bundle
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const { text } = await parser.getText();
  return text as string;
}
