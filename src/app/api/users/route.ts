import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const isAdmin = session.user.role === "ADMIN";

  const users = await prisma.user.findMany({
    where: isAdmin ? undefined : { active: true },
    select: isAdmin
      ? { id: true, name: true, email: true, role: true, active: true, createdAt: true }
      : { id: true, name: true, email: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const body = await req.json();
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { name, email, password, role, active } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "El email ya está registrado" }, { status: 409 });

  const hashedPassword = password ? await bcrypt.hash(password, 12) : undefined;

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role, active },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
