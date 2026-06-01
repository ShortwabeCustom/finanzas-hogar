import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecoveryPlan } from "@/lib/financial/recovery-plan";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const monthsParam = req.nextUrl.searchParams.get("months");
    const months = monthsParam ? Math.max(1, Math.min(parseInt(monthsParam, 10) || 3, 12)) : 3;

    const plan = await getRecoveryPlan(session.user.id, months);
    return NextResponse.json(plan, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    console.error(
      "[financial/recovery-plan]",
      error instanceof Error ? error : "Error desconocido"
    );
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
