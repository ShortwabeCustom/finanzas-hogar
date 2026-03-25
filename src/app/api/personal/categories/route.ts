import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { personalCategorySchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") !== "false";

  const categories = await prisma.personalCategory.findMany({
    where: { userId, ...(activeOnly ? { active: true } : {}) },
    include: { _count: { select: { payments: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const userId = session.user.id;
  const body = await req.json();
  const parsed = personalCategorySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.personalCategory.findUnique({
    where: { userId_name: { userId, name: parsed.data.name } },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una categoría con ese nombre" }, { status: 409 });
  }

  const category = await prisma.personalCategory.create({
    data: { ...parsed.data, userId },
    include: { _count: { select: { payments: true } } },
  });

  return NextResponse.json(category, { status: 201 });
}
