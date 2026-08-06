import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/analytics/log
 * Optional server-side analytics logging
 * Can be called from client or server (no auth required for tracking)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventName, properties, timestamp } = body;

    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json({ error: "eventName requerido" }, { status: 400 });
    }

    // Optional: Get user ID if session exists
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    // Log event (in production, could send to external service or database)
    console.log("[Analytics Server]", {
      eventName,
      userId,
      timestamp,
      properties,
      userAgent: req.headers.get("user-agent"),
      ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[analytics/log POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
