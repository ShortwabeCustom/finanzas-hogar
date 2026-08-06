import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/personal/accounts
 * Retrieve all accounts owned by the current user.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch user's accounts from the database
    const accounts = await prisma.account.findMany({
      where: {
        users: {
          some: {
            userId: userId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        bankName: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      data: accounts.map((account) => ({
        id: account.id,
        name: account.name || `${account.bankName} - ${account.type}`,
      })),
    });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Error al obtener cuentas" },
      { status: 500 }
    );
  }
}
