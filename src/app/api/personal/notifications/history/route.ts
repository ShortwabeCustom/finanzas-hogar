import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Get notification history
    const notifications = await prisma.debtNotification.findMany({
      where: { userId },
      include: {
        debt: {
          select: {
            id: true,
            name: true,
            currentPrincipal: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100), // Cap at 100 to prevent abuse
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('[GET /api/personal/notifications/history]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
