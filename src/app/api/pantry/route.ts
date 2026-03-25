import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pantryItemSchema } from "@/lib/validations";
import { computeMetrics } from "@/lib/productMetrics";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const categoryId = searchParams.get("categoryId") ?? "";
  const alert = searchParams.get("alert") ?? "";

  const where: any = { active: true };
  if (search) where.name = { contains: search, mode: "insensitive" };
  if (categoryId) where.categoryId = categoryId;

  const items = await prisma.pantryItem.findMany({
    where,
    include: {
      category: true,
      addedBy: { select: { id: true, name: true } },
      purchaseHistory: { orderBy: { purchaseDate: "desc" } },
    },
    orderBy: { name: "asc" },
  });

  const withMetrics = items.map((i) => ({ ...i, metrics: computeMetrics(i.purchaseHistory) }));

  if (alert === "low") {
    return NextResponse.json(withMetrics.filter((i) => Number(i.quantity) <= Number(i.minStock)));
  }
  if (alert === "expiring") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 7);
    return NextResponse.json(
      withMetrics.filter((i) => i.expiryDate && new Date(i.expiryDate) <= threshold)
    );
  }

  return NextResponse.json(withMetrics);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const parsed = pantryItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  try {
    const item = await prisma.pantryItem.create({
      data: {
        name: data.name,
        categoryId: data.categoryId,
        quantity: data.quantity ?? 1,
        unit: data.unit ?? "PCS",
        minStock: data.minStock ?? 1,
        price: data.price != null ? data.price : null,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        comments: data.comments ?? null,
        addedById: session.user.id,
      },
      include: { category: true, addedBy: { select: { id: true, name: true } }, purchaseHistory: { orderBy: { purchaseDate: "desc" } } },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/pantry]", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}
