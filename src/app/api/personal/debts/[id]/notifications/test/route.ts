import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/notifications/notification-service';

const notificationService = new NotificationService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id: debtId } = await params;
    const userId = session.user.id;

    // Verify debt ownership
    const debt = await prisma.debtAccount.findUnique({
      where: { id: debtId },
      select: { userId: true, name: true, currentPrincipal: true, nextDueDate: true },
    });

    if (!debt || debt.userId !== userId) {
      return NextResponse.json({ error: 'Deuda no encontrada' }, { status: 404 });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Send test email notification
    const emailResult = await notificationService.sendEmailNotification({
      type: 'EMAIL',
      userId,
      debtId,
      debtName: debt.name,
      debtAmount: typeof debt.currentPrincipal === 'number'
        ? debt.currentPrincipal
        : parseFloat(debt.currentPrincipal.toString()),
      dueDate: debt.nextDueDate || new Date(),
      daysBefore: 3,
      recipient: {
        email: user.email || '',
        name: user.name || '',
      },
    });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: 'No se pudo enviar la notificación de prueba', details: emailResult.error },
        { status: 500 }
      );
    }

    // Log test notification sent
    await prisma.debtNotification.create({
      data: {
        userId,
        debtId,
        type: 'EMAIL',
        status: 'SENT',
        subject: 'Notificación de prueba - Recordatorio de deuda',
        message: `Esto es una prueba. Tu deuda "${debt.name}" tiene un saldo de $${debt.currentPrincipal}.`,
        recipientEmail: user.email,
        recipientPhone: user.phone,
        dueDate: debt.nextDueDate || new Date(),
        daysBefore: 3,
        nextRetryAt: new Date(),
        sentAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notificación de prueba enviada exitosamente',
      messageId: emailResult.messageId,
    });
  } catch (error) {
    console.error('[POST /api/personal/debts/[id]/notifications/test]', error);
    return NextResponse.json(
      {
        error: 'Error al enviar notificación de prueba',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
