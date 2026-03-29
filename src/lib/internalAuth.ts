import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the internal API token sent by n8n (or any trusted internal service).
 * Header expected: x-internal-token: <INTERNAL_API_TOKEN>
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function validateInternalToken(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;

  if (!expected) {
    console.error("[internalAuth] INTERNAL_API_TOKEN env var not set");
    return NextResponse.json({ error: "Configuración interna incorrecta" }, { status: 500 });
  }

  if (!token || token !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
