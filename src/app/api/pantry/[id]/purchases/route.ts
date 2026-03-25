import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productPurchaseSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const item = await prisma.pantryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const history = await prisma.pantryPurchaseHistory.findMany({
    where: { pantryItemId: id },
    orderBy: { purchaseDate: "desc" },
  });

  return NextResponse.json(history);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await params;
  const item = await prisma.pantryItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = productPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newDate = new Date(parsed.data.purchaseDate);

  const lastPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id },
    orderBy: { purchaseDate: "desc" },
  });

  let previousPurchaseDate: Date | null = null;
  let daysElapsed: number | null = null;

  if (lastPurchase) {
    previousPurchaseDate = lastPurchase.purchaseDate;
    const diffMs = newDate.getTime() - lastPurchase.purchaseDate.getTime();
    daysElapsed = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  const purchasePrice = parsed.data.price ?? null;

  const [purchase] = await prisma.$transaction([
    prisma.pantryPurchaseHistory.create({
      data: {
        pantryItemId: id,
        purchaseDate: newDate,
        previousPurchaseDate,
        daysElapsed,
        price: purchasePrice,
        notes: parsed.data.notes ?? null,
      },
    }),
    // Sync purchaseDate and price on PantryItem
    prisma.pantryItem.update({
      where: { id },
      data: {
        purchaseDate: newDate,
        ...(purchasePrice !== null ? { price: purchasePrice } : {}),
      },
    }),
  ]);

  return NextResponse.json(purchase, { status: 201 });
}
