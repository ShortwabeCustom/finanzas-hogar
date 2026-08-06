import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getImportSession, deleteImportSession } from "@/lib/statements/import-manager";
import { importStatement } from "@/lib/financial/import";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const body = await req.json();
    const { importId } = body;

    if (!importId) {
      return NextResponse.json({ error: "importId requerido" }, { status: 400 });
    }

    const importSession = getImportSession(importId);

    if (!importSession) {
      return NextResponse.json({ error: "Sesión de importación no encontrada o expirada" }, { status: 404 });
    }

    if (importSession.userId !== userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (importSession.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `No se puede confirmar importación en estado: ${importSession.status}` },
        { status: 400 }
      );
    }

    if (!importSession.payload) {
      return NextResponse.json({ error: "Datos de importación no encontrados" }, { status: 400 });
    }

    // Perform actual import (save to database)
    const summary = await importStatement(importSession.payload, userId, "PERSONAL");

    // Clean up session
    deleteImportSession(importId);

    return NextResponse.json(
      {
        success: true,
        statementId: summary.statementId || "stmt_generated",
        transactionsCreated: summary.imported,
        transactionsSkipped: summary.skipped,
        accountId: importSession.payload.account?.id ?? "acc_unknown",
        message: `${summary.imported} transacciones importadas exitosamente`,
        errors: summary.errors,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[personal/statements/import/confirm POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
