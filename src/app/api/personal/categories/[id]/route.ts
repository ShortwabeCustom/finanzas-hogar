import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalCategorySchema } from "@/lib/validations";

async function getOwnedCategory(id: string, userId: string) {
  const cat = await prisma.personalCategory.findUnique({ where: { id } });
  if (!cat || cat.userId !== userId) return null;
  return cat;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const cat = await getOwnedCategory(id, session.user.id);
  if (!cat) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(cat);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id;
  const cat = await getOwnedCategory(id, userId);
  if (!cat) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json();
  const parsed = personalCategorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Check name uniqueness (excluding self)
  if (parsed.data.name !== cat.name) {
    const conflict = await prisma.personalCategory.findUnique({
      where: { userId_name: { userId, name: parsed.data.name } },
    });
    if (conflict) return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const updated = await prisma.personalCategory.update({
    where: { id },
    data: parsed.data,
    include: { _count: { select: { payments: true } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const cat = await getOwnedCategory(id, session.user.id);
  if (!cat) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Check if category has payments
  const count = await prisma.personalPayment.count({ where: { categoryId: id } });
  if (count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} pago(s) asociado(s)` },
      { status: 409 }
    );
  }

  await prisma.personalCategory.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
