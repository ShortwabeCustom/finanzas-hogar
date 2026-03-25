import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password, role, active } = parsed.data;
  const updateData: any = { name, email, role, active };
  if (password) updateData.password = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "1";

  if (hard) {
    // Eliminar permanentemente: desvincular registros primero
    await prisma.payment.updateMany({ where: { paidById: id }, data: { paidById: null } });
    await prisma.pantryItem.updateMany({ where: { addedById: id }, data: { addedById: null } });
    await prisma.user.delete({ where: { id } });
  } else {
    // Soft delete: solo desactivar acceso
    await prisma.user.update({ where: { id }, data: { active: false } });
  }

  return NextResponse.json({ success: true });
}
