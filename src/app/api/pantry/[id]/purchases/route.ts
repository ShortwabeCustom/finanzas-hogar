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
  const purchasePrice = parsed.data.price ?? null;

  // Find the chronological predecessor (most recent purchase BEFORE newDate)
  const prevPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { lt: newDate } },
    orderBy: { purchaseDate: "desc" },
  });

  const previousPurchaseDate = prevPurchase ? prevPurchase.purchaseDate : null;
  const daysElapsed = previousPurchaseDate
    ? Math.round((newDate.getTime() - previousPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Also find if there's a successor (purchase that was previously referencing the predecessor)
  // so we can update its previousPurchaseDate/daysElapsed
  const nextPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { gt: newDate } },
    orderBy: { purchaseDate: "asc" },
  });

  const latestPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id },
    orderBy: { purchaseDate: "desc" },
  });
  const isNewest = !latestPurchase || newDate >= latestPurchase.purchaseDate;

  const ops: any[] = [
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
  ];

  // Update successor's previousPurchaseDate and daysElapsed to point to newDate
  if (nextPurchase) {
    const newDaysForSuccessor = Math.round(
      (nextPurchase.purchaseDate.getTime() - newDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    ops.push(
      prisma.pantryPurchaseHistory.update({
        where: { id: nextPurchase.id },
        data: { previousPurchaseDate: newDate, daysElapsed: newDaysForSuccessor },
      })
    );
  }

  // Sync purchaseDate on PantryItem only if this is the newest purchase
  if (isNewest) {
    ops.push(
      prisma.pantryItem.update({
        where: { id },
        data: {
          purchaseDate: newDate,
          ...(purchasePrice !== null ? { price: purchasePrice } : {}),
        },
      })
    );
  }

  const [purchase] = await prisma.$transaction(ops);

  return NextResponse.json(purchase, { status: 201 });
}
