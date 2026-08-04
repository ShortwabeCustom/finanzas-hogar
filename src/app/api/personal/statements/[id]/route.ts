import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { id } = await params;
    const userId = session.user.id;
    const body = await req.json();

    const statement = await prisma.bankStatement.findFirst({
      where: { id, account: { userId } },
      select: { id: true },
    });
    if (!statement) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const { assignedMonth, assignedYear, assignedMonthSource } = body;

    const month = assignedMonth != null ? Number(assignedMonth) : null;
    const year  = assignedYear  != null ? Number(assignedYear)  : null;

    if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
      return NextResponse.json({ error: "Mes inválido (debe ser 1–12)" }, { status: 400 });
    }
    if (year !== null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
      return NextResponse.json({ error: "Año inválido" }, { status: 400 });
    }
    if (assignedMonthSource != null && !["manual", "auto"].includes(assignedMonthSource)) {
      return NextResponse.json({ error: "assignedMonthSource inválido" }, { status: 400 });
    }

    const updated = await prisma.bankStatement.update({
      where: { id },
      data: {
        assignedMonth: month,
        assignedYear:  year,
        assignedMonthSource: assignedMonthSource ?? "auto",
      },
      include: { account: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[personal/statements PATCH]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

/**
 * DELETE /api/personal/statements/[id]
 * Deletes an owned bank statement and its imported bank transactions.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (session.user.role === "VIEWER") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { id } = await params;
    const userId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const statement = await tx.bankStatement.findFirst({
        where: { id, account: { userId } },
        select: { id: true },
      });

      if (!statement) {
        return null;
      }

      const deletedTransactions = await tx.bankTransaction.deleteMany({
        where: { statementId: statement.id },
      });

      await tx.bankStatement.delete({ where: { id: statement.id } });

      return { deletedTransactions: deletedTransactions.count };
    });

    if (!result) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[personal/statements DELETE]", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
