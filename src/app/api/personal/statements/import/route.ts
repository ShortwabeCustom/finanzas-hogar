import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createImportSession, updateImportSession, getImportSession } from "@/lib/statements/import-manager";
import { extractPdfText } from "@/lib/financial/parsers/ai-fallback";
import { isSantanderCheckingPDF, parseSantanderPDF } from "@/lib/financial/parsers/santander-pdf";
import { isSantanderCreditPDF, parseSantanderCreditPDF } from "@/lib/financial/parsers/santander-credit-pdf";
import type { ImportStatementPayload } from "@/types/financial";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const bankType = (formData.get("bankType") as string) ?? "AUTO_DETECT";

    // Validation
    if (!file) {
      return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Solo se aceptan archivos PDF" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `El archivo no debe exceder 5MB. Tamaño actual: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    // Create import session
    const importSession = createImportSession(userId);

    // Parse PDF in background
    parseAndPreviewStatement(file, bankType, importSession.importId, userId).catch((error) => {
      console.error(`[personal/statements/import] Parse error for ${importSession.importId}:`, error);
      updateImportSession(importSession.importId, {
        status: "FAILED",
        error: {
          code: "PARSE_ERROR",
          message: error instanceof Error ? error.message : "Error procesando PDF",
        },
      });
    });

    // Return immediately with import session info
    return NextResponse.json({
      importId: importSession.importId,
      status: "PROCESSING",
      progress: {
        step: 1,
        stepName: "Cargando archivo...",
        total: 4,
        percentage: 25,
      },
    });
  } catch (error) {
    console.error("[personal/statements/import POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function parseAndPreviewStatement(
  file: File,
  bankType: string,
  importId: string,
  userId: string
): Promise<void> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Step 2: Extract text and detect format
    updateImportSession(importId, {
      step: 2,
      stepName: "Analizando documento...",
      percentage: 40,
    });

    const pdfText = await extractPdfText(buffer);

    // Detect bank and type
    let parsed: ImportStatementPayload | null = null;

    if (bankType === "SANTANDER_CREDIT" || bankType === "AUTO_DETECT") {
      // Try credit card first
      try {
        if (isSantanderCreditPDF(pdfText) || bankType === "SANTANDER_CREDIT") {
          const result = await parseSantanderCreditPDF(pdfText, "santander-statement.pdf");
          if (result) {
            parsed = result;
          }
        }
      } catch (e) {
        // Fallthrough to checking account
      }
    }

    // Try checking account if not already parsed
    if (!parsed && (bankType === "SANTANDER" || bankType === "AUTO_DETECT")) {
      try {
        if (isSantanderCheckingPDF(pdfText) || bankType === "SANTANDER") {
          const results = await parseSantanderPDF(buffer);
          if (results && results.length > 0) {
            parsed = results[0];
          }
        }
      } catch (e) {
        // Fallthrough
      }
    }

    if (!parsed) {
      throw new Error("No se pudo extraer datos del PDF. Verifica que sea un estado de cuenta Santander válido.");
    }

    // Step 3: Prepare preview
    updateImportSession(importId, {
      step: 3,
      stepName: "Preparando vista previa...",
      percentage: 75,
    });

    const previewTransactions = (parsed.transactions ?? []).slice(0, 5).map((txn: any) => ({
      date: txn.transactionDate,
      description: txn.description,
      chargeAmount: txn.chargeAmount ?? null,
      creditAmount: txn.creditAmount ?? null,
    }));

    // Step 4: Complete with preview
    updateImportSession(importId, {
      status: "COMPLETED",
      step: 4,
      stepName: "Listo para importar",
      percentage: 100,
      preview: {
        bankName: parsed.account?.bankName ?? "Banco Desconocido",
        period: `${parsed.statement?.periodStart ?? "N/A"}`,
        transactionCount: parsed.transactions?.length ?? 0,
        statementDate: parsed.statement?.periodEnd ?? new Date().toISOString().split("T")[0],
        transactions: previewTransactions,
      },
      payload: parsed,
    });
  } catch (error) {
    throw error;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const importId = searchParams.get("importId");

    if (!importId) {
      return NextResponse.json({ error: "importId requerido" }, { status: 400 });
    }

    const importSession = getImportSession(importId);

    if (!importSession) {
      return NextResponse.json({ error: "Sesión de importación no encontrada o expirada" }, { status: 404 });
    }

    if (importSession.userId !== session.user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json({
      importId: importSession.importId,
      status: importSession.status,
      progress: {
        step: importSession.step,
        stepName: importSession.stepName,
        total: importSession.totalSteps,
        percentage: importSession.percentage,
      },
      preview: importSession.preview,
      error: importSession.error,
    });
  } catch (error) {
    console.error("[personal/statements/import GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
