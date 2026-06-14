import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { importStatement } from "@/lib/financial/import";
import { isSantanderECB, parseSantanderECB } from "@/lib/financial/parsers/santander-ecb";
import { isSantanderCheckingPDF, parseSantanderPDF } from "@/lib/financial/parsers/santander-pdf";
import { extractPdfText, parseWithAI } from "@/lib/financial/parsers/ai-fallback";
import { parseStatementWithVision, VisionOcrError } from "@/lib/financial/parsers/vision-ocr";
import { Prisma } from "@prisma/client";
import type { ImportSummary, ImportStatementPayload } from "@/types/financial";

const MAX_BYTES = 10 * 1024 * 1024;

const VISION_ERROR_STATUS: Record<string, number> = {
  MISSING_OPENAI_API_KEY:    503,
  PDFTOPPM_NOT_FOUND:        503,
  NO_TRANSACTIONS_DETECTED:  422,
  OPENAI_SCHEMA_ERROR:       422,
  INVALID_OCR_PAYLOAD:       422,
  OPENAI_MODEL_ERROR:        502,
};

function isXmlFile(file: Blob, name: string): boolean {
  return file.type.includes("xml") || name.toLowerCase().endsWith(".xml");
}

function getExtension(name: string): string {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext ? `.${ext}` : "unknown";
}

function getVisionErrorStatus(err: VisionOcrError): number {
  return VISION_ERROR_STATUS[err.name] ?? VISION_ERROR_STATUS[err.code] ?? 422;
}

function getSafeVisionDetails(err: VisionOcrError): Record<string, unknown> {
  const allowedKeys = new Set(["model", "status", "code", "type", "param", "requestID", "command", "reason", "issueCount", "fields"]);
  return Object.fromEntries(
    Object.entries(err.details).filter(([key]) => allowedKeys.has(key))
  );
}

function logVisionOcrFailure(err: VisionOcrError, status: number, file: Blob, fileName: string) {
  console.warn("[statements/import] vision_ocr_failed", {
    errorName: err.name,
    status,
    fileType: file.type || "application/pdf",
    fileExt: getExtension(fileName),
    fileSizeBytes: file.size,
    details: getSafeVisionDetails(err),
  });
}

function logUnexpectedVisionFailure(err: unknown, file: Blob, fileName: string) {
  console.error("[statements/import] vision_ocr_unhandled_error", {
    errorName: err instanceof Error ? err.name : typeof err,
    message: err instanceof Error ? err.message : "Unknown OCR error",
    fileType: file.type || "application/pdf",
    fileExt: getExtension(fileName),
    fileSizeBytes: file.size,
  });
}

/**
 * POST /api/personal/statements/import
 *
 * Accepts PDF or XML (CFDI-ECB Santander).
 *
 * PDF routing (in priority order):
 *  1. Scanned PDF (pdfText < 200 chars) → OpenAI Vision OCR via vision-ocr.ts
 *     Supports Santander Cuenta Corriente AND Santander AMEX/Tarjeta de Crédito.
 *     Requires OPENAI_API_KEY; returns 503 if missing.
 *  2. Santander Cuenta Corriente (digital PDF) — in-process parser, no external deps
 *  3. Other digital PDFs → OpenAI text fallback (gpt-4o-mini) via ai-fallback.ts
 *     Requires OPENAI_API_KEY; returns 503 if missing.
 *
 * XML routing:
 *  - Santander CFDI-ECB — in-process parser (santander-ecb.ts)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "El archivo supera el límite de 10 MB" }, { status: 413 });
    }

    const fileName = file instanceof File ? file.name : "archivo";

    // ── XML path: Santander CFDI-ECB in-process ───────────────────────────────
    if (isXmlFile(file, fileName)) {
      const xmlText = await file.text();

      if (!isSantanderECB(xmlText)) {
        return NextResponse.json(
          { error: "Solo se soportan XML de estado de cuenta Santander (CFDI con addenda ECB)" },
          { status: 422 }
        );
      }

      let payload: ImportStatementPayload;
      try {
        payload = parseSantanderECB(xmlText);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al leer el XML";
        return NextResponse.json({ error: msg }, { status: 422 });
      }

      const summary = await runImport([payload], userId);
      return NextResponse.json(summary, { status: 200 });
    }

    // ── PDF path ──────────────────────────────────────────────────────────────
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Solo se aceptan archivos PDF o XML de Santander" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 1: extract raw text (shared between both PDF parsers)
    let pdfText: string;
    try {
      pdfText = await extractPdfText(buffer);
    } catch (err) {
      console.error("[statements/import] pdf-parse error", err);
      return NextResponse.json(
        { error: "No se pudo leer el contenido del PDF. Verifica que no esté protegido con contraseña." },
        { status: 422 }
      );
    }

    // Detect image-only (scanned) PDFs — pdf-parse can't extract text from them.
    // A real bank statement has hundreds of lines; page markers alone = scanned PDF.
    const isScannedPdf =
      pdfText.trim().length < 200 ||
      /^(\s*--\s*\d+\s+of\s+\d+\s*--\s*)+$/.test(pdfText.trim());

    if (isScannedPdf) {
      let visionPayload: ImportStatementPayload;
      try {
        visionPayload = await parseStatementWithVision(buffer, fileName);
      } catch (err) {
        if (err instanceof VisionOcrError) {
          const status = getVisionErrorStatus(err);
          logVisionOcrFailure(err, status, file, fileName);
          return NextResponse.json(
            { error: err.message, code: err.name },
            { status }
          );
        }

        logUnexpectedVisionFailure(err, file, fileName);
        return NextResponse.json(
          {
            error:
              "No se pudo procesar el PDF escaneado con OCR. Intenta de nuevo o descarga el PDF digital desde Santander.",
          },
          { status: 502 }
        );
      }

      const summary = await runImport([visionPayload], userId);
      return NextResponse.json(summary, { status: 200 });
    }

    // Step 2: try Santander Cuenta Corriente in-process parser
    if (isSantanderCheckingPDF(pdfText)) {
      let payloads: ImportStatementPayload[];
      try {
        payloads = await parseSantanderPDF(buffer);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al parsear el PDF de Santander";
        return NextResponse.json({ error: msg }, { status: 422 });
      }

      const summary = await runImport(payloads, userId);
      return NextResponse.json(summary, { status: 200 });
    }

    // Step 3: OpenAI fallback for unrecognized PDF formats
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Este PDF no es de Santander Cuenta Corriente. Para otros bancos o formatos, " +
            "configura OPENAI_API_KEY en el servidor para habilitar el parser de IA.",
        },
        { status: 503 }
      );
    }

    let payload: ImportStatementPayload;
    try {
      payload = await parseWithAI(pdfText, fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error en el parser de IA";
      console.error("[statements/import] AI parser error", err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const summary = await runImport([payload], userId);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Sesión inválida. Cierra sesión y vuelve a entrar." },
        { status: 401 }
      );
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
      console.error("[statements/import] Prisma validation error", error.message);
      return NextResponse.json(
        { error: "Los datos extraídos del archivo no son válidos. Verifica que el PDF sea un estado de cuenta legible y no esté protegido." },
        { status: 422 }
      );
    }
    console.error("[statements/import]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/** Calls importStatement for each payload and aggregates the summaries. */
async function runImport(payloads: ImportStatementPayload[], userId: string): Promise<ImportSummary> {
  const results = await Promise.all(
    payloads.map(async (p) => {
      try {
        return await importStatement(p, userId, "PERSONAL");
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "USER_NOT_FOUND") {
          throw Object.assign(new Error("USER_NOT_FOUND"), { isUserError: true });
        }
        throw err;
      }
    })
  );

  return results.reduce<ImportSummary>(
    (acc, r) => ({
      imported: acc.imported + r.imported,
      skipped:  acc.skipped  + r.skipped,
      errors:   [...acc.errors, ...r.errors],
    }),
    { imported: 0, skipped: 0, errors: [] }
  );
}
