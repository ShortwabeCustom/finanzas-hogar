import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productPurchaseSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string; purchaseId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id, purchaseId } = await params;

  const purchase = await prisma.pantryPurchaseHistory.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.pantryItemId !== id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = productPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newDate = new Date(parsed.data.purchaseDate);
  const purchasePrice = parsed.data.price ?? null;

  // Recalculate daysElapsed based on the new date
  const prevPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { lt: newDate }, id: { not: purchaseId } },
    orderBy: { purchaseDate: "desc" },
  });

  const previousPurchaseDate = prevPurchase ? prevPurchase.purchaseDate : null;
  const daysElapsed = previousPurchaseDate
    ? Math.round((newDate.getTime() - previousPurchaseDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Find successor to update its reference
  const nextPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { gt: newDate }, id: { not: purchaseId } },
    orderBy: { purchaseDate: "asc" },
  });

  const ops: any[] = [
    prisma.pantryPurchaseHistory.update({
      where: { id: purchaseId },
      data: {
        purchaseDate: newDate,
        previousPurchaseDate,
        daysElapsed,
        price: purchasePrice,
        notes: parsed.data.notes ?? null,
      },
    }),
  ];

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

  // Sync purchaseDate on PantryItem if this is the newest purchase
  const newestPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id },
    orderBy: { purchaseDate: "desc" },
  });
  if (!newestPurchase || newDate >= newestPurchase.purchaseDate || newestPurchase.id === purchaseId) {
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

  const [updated] = await prisma.$transaction(ops);
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id, purchaseId } = await params;

  const purchase = await prisma.pantryPurchaseHistory.findUnique({ where: { id: purchaseId } });
  if (!purchase || purchase.pantryItemId !== id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Find successor to repair its previousPurchaseDate/daysElapsed
  const nextPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { gt: purchase.purchaseDate } },
    orderBy: { purchaseDate: "asc" },
  });

  const prevPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, purchaseDate: { lt: purchase.purchaseDate } },
    orderBy: { purchaseDate: "desc" },
  });

  const ops: any[] = [prisma.pantryPurchaseHistory.delete({ where: { id: purchaseId } })];

  if (nextPurchase) {
    const newPrev = prevPurchase ? prevPurchase.purchaseDate : null;
    const newDays = newPrev
      ? Math.round((nextPurchase.purchaseDate.getTime() - newPrev.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    ops.push(
      prisma.pantryPurchaseHistory.update({
        where: { id: nextPurchase.id },
        data: { previousPurchaseDate: newPrev, daysElapsed: newDays },
      })
    );
  }

  // If deleted was the newest, update PantryItem to the new newest
  const newestPurchase = await prisma.pantryPurchaseHistory.findFirst({
    where: { pantryItemId: id, id: { not: purchaseId } },
    orderBy: { purchaseDate: "desc" },
  });
  if (!nextPurchase && newestPurchase) {
    ops.push(
      prisma.pantryItem.update({
        where: { id },
        data: { purchaseDate: newestPurchase.purchaseDate, price: newestPurchase.price },
      })
    );
  } else if (!nextPurchase && !newestPurchase) {
    ops.push(
      prisma.pantryItem.update({
        where: { id },
        data: { purchaseDate: null },
      })
    );
  }

  await prisma.$transaction(ops);
  return NextResponse.json({ ok: true });
}
