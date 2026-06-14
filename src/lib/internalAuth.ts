import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Validates the internal API token sent by n8n (or any trusted internal service).
 * Header expected: x-internal-token: <INTERNAL_API_TOKEN>
 * Returns null if valid, or a 401 NextResponse if invalid.
 *
 * Uses timingSafeEqual to prevent timing-based token enumeration attacks.
 */
export function validateInternalToken(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-internal-token");
  const expected = process.env.INTERNAL_API_TOKEN;

  if (!expected) {
    console.error("[internalAuth] INTERNAL_API_TOKEN env var not set");
    return NextResponse.json({ error: "Configuración interna incorrecta" }, { status: 500 });
  }

  let valid = false;
  if (token) {
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(expected);
      valid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      valid = false;
    }
  }

  if (!valid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return null;
}
