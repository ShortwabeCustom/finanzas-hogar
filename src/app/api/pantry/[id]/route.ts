import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pantryItemSchema } from "@/lib/validations";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = pantryItemSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  try {
    // Fetch existing to preserve quantity/unit/minStock/expiryDate if not provided
    const existing = await prisma.pantryItem.findUnique({ where: { id } });
    const item = await prisma.pantryItem.update({
      where: { id },
      data: {
        name: data.name,
        categoryId: data.categoryId,
        quantity: data.quantity ?? Number(existing?.quantity ?? 1),
        unit: (data.unit ?? existing?.unit ?? "PCS") as any,
        minStock: data.minStock ?? Number(existing?.minStock ?? 1),
        price: data.price != null ? data.price : (existing?.price ?? null),
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : (existing?.purchaseDate ?? null),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : (existing?.expiryDate ?? null),
        comments: data.comments ?? null,
      },
      include: { category: true, addedBy: { select: { id: true, name: true } }, purchaseHistory: { orderBy: { purchaseDate: "desc" } } },
    });
    return NextResponse.json(item);
  } catch (e: any) {
    console.error("[PUT /api/pantry/:id]", e);
    return NextResponse.json({ error: e?.message ?? "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await params;
  await prisma.pantryItem.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ success: true });
}
