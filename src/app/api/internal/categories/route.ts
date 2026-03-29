import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateInternalToken } from "@/lib/internalAuth";

/**
 * GET /api/internal/categories
 * Returns all active categories so n8n can map LLM output → real categoryId.
 */
export async function GET(req: NextRequest) {
  const authError = validateInternalToken(req);
  if (authError) return authError;

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}
