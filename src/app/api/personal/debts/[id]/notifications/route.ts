import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { NotificationService } from '@/lib/notifications/notification-service';

const createNotificationSchema = z.object({
  type: z.enum(['EMAIL', 'WHATSAPP']),
  daysBefore: z.number().min(0).max(30).default(3),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
});

type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const debtId = params.id;
    const userId = session.user.id;

    // Verify debt ownership
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      select: { userId: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 });
    }

    // Get notification history
    const notifications = await prisma.debtNotification.findMany({
      where: { debtId, userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error('[GET /api/personal/debts/[id]/notifications]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const debtId = params.id;
    const userId = session.user.id;

    // Verify debt ownership
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      select: { userId: true, name: true, currentPrincipal: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = createNotificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Validate recipient based on type
    if (data.type === 'EMAIL') {
      if (!data.recipientEmail && !user.email) {
        return NextResponse.json(
          { error: 'Email del destinatario es requerido' },
          { status: 400 }
        );
      }
    } else if (data.type === 'WHATSAPP') {
      if (!data.recipientPhone) {
        return NextResponse.json(
          { error: 'Número de teléfono es requerido para WhatsApp' },
          { status: 400 }
        );
      }
    }

    // Check for duplicate notifications
    const existing = await prisma.debtNotification.findFirst({
      where: {
        debtId,
        userId,
        type: data.type,
        daysBefore: data.daysBefore,
        status: { not: 'FAILED' },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una notificación para esta deuda con esta configuración' },
        { status: 409 }
      );
    }

    // Calculate next retry date (days before due date)
    const dueDate = debt ? (debt as any).nextDueDate : new Date();
    const nextRetryAt = new Date(dueDate);
    nextRetryAt.setDate(nextRetryAt.getDate() - data.daysBefore);

    // Create notification
    const notification = await prisma.debtNotification.create({
      data: {
        userId,
        debtId,
        type: data.type,
        status: 'PENDING',
        subject: data.type === 'EMAIL' ? `Recordatorio: Deuda próxima a vencer` : undefined,
        message:
          data.type === 'EMAIL'
            ? `Tu deuda "${debt.name}" vence en ${data.daysBefore} días.`
            : `Recordatorio: Tu deuda "${debt.name}" vence en ${data.daysBefore} días.`,
        recipientEmail: data.recipientEmail || user.email,
        recipientPhone: data.recipientPhone,
        dueDate: dueDate instanceof Date ? dueDate : new Date(dueDate),
        daysBefore: data.daysBefore,
        nextRetryAt,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error('[POST /api/personal/debts/[id]/notifications]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const debtId = params.id;
    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const notificationId = searchParams.get('notificationId');

    if (!notificationId) {
      return NextResponse.json({ error: 'ID de notificación requerido' }, { status: 400 });
    }

    // Verify notification ownership
    const notification = await prisma.debtNotification.findUnique({
      where: { id: notificationId },
      select: { userId: true, debtId: true },
    });

    if (!notification || notification.userId !== userId || notification.debtId !== debtId) {
      return NextResponse.json({ error: 'Notificación no encontrada' }, { status: 404 });
    }

    // Cancel notification
    await prisma.debtNotification.update({
      where: { id: notificationId },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/personal/debts/[id]/notifications]', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
