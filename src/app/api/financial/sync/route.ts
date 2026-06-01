import { NextRequest, NextResponse } from "next/server";
import { validateInternalToken } from "@/lib/internalAuth";
import { syncBankToPersonalPayments } from "@/lib/financial/sync";

export async function POST(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { userId } = body as { userId?: string };

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    }

    const result = await syncBankToPersonalPayments(userId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[financial/sync POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
