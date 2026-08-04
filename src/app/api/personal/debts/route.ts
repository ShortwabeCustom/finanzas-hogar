import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtFormSchema } from "@/lib/validations/debt";
import { generateFolio } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const direction = searchParams.get("direction");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search") ?? "";
    const cardId = searchParams.get("cardId");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");

    const where: any = { userId };

    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (type) where.type = type;
    if (cardId) where.personalCardId = cardId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { counterpartyName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dueFrom || dueTo) {
      where.nextDueDate = {};
      if (dueFrom) where.nextDueDate.gte = new Date(dueFrom);
      if (dueTo) where.nextDueDate.lte = new Date(dueTo);
    }

    const debts = await prisma.debtAccount.findMany({
      where,
      include: {
        personalCard: true,
        _count: { select: { installments: true, payments: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    return NextResponse.json(debts);
  } catch (error) {
    console.error("[personal/debts GET]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    if (session.user.role === "VIEWER") {
      return NextResponse.json({ error: "No tienes permisos para crear deudas" }, { status: 403 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const parsed = debtFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // Validaciones de negocio
    if (data.currentPrincipal > data.originalPrincipal) {
      return NextResponse.json(
        { error: "El saldo inicial no puede superar el monto original" },
        { status: 400 }
      );
    }

    // Verificar tarjeta si se proporciona
    if (data.personalCardId) {
      const card = await prisma.personalCard.findUnique({
        where: { id: data.personalCardId },
      });
      if (!card || card.userId !== userId || !card.active) {
        return NextResponse.json({ error: "Tarjeta inválida" }, { status: 400 });
      }
    }

    // Crear deuda
    const debt = await prisma.debtAccount.create({
      data: {
        userId,
        direction: data.direction,
        type: data.type,
        name: data.name,
        counterpartyName: data.counterpartyName || null,
        originalPrincipal: data.originalPrincipal,
        currentPrincipal: data.currentPrincipal,
        annualInterestRate: data.annualInterestRate || null,
        scheduleMode: data.scheduleMode,
        paymentFrequency: data.paymentFrequency || null,
        scheduledPayment: data.scheduledPayment || null,
        numberOfInstallments: data.numberOfInstallments || null,
        startDate: new Date(data.startDate),
        estimatedEndDate: data.estimatedEndDate ? new Date(data.estimatedEndDate) : null,
        nextDueDate: null,
        personalCardId: data.personalCardId || null,
        status: "ACTIVE",
        notes: data.notes || null,
        agreementUrl: data.agreementUrl || null,
      },
      include: {
        personalCard: true,
        _count: { select: { installments: true, payments: true } },
      },
    });

    return NextResponse.json(debt, { status: 201 });
  } catch (error) {
    console.error("[personal/debts POST]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
