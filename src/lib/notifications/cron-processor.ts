import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/lib/notifications/notification-service';

const notificationService = new NotificationService();

interface CronResult {
  processed: number;
  failed: number;
}

export async function processPendingNotifications(): Promise<CronResult> {
  const processed: string[] = [];
  const failed: string[] = [];

  try {
    // 1. Obtener todas las notificaciones PENDING
    const pendingNotifications = await prisma.debtNotification.findMany({
      where: { status: 'PENDING' },
      include: {
        debt: true,
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            name: true,
          },
        },
      },
    });

    console.log(
      `[Cron] Encontradas ${pendingNotifications.length} notificaciones pendientes`
    );

    // 2. Filtrar: Determinar cuáles deben enviarse hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notificationsToSend = pendingNotifications.filter((notif) => {
      if (!notif.debt.nextDueDate) return false;

      const dueDate = new Date(notif.debt.nextDueDate);
      const sendDate = new Date(dueDate);
      sendDate.setDate(sendDate.getDate() - notif.daysBefore);
      sendDate.setHours(0, 0, 0, 0);

      return sendDate.getTime() === today.getTime();
    });

    console.log(
      `[Cron] ${notificationsToSend.length} notificaciones listas para enviar hoy`
    );

    // 3. Enviar cada notificación
    for (const notif of notificationsToSend) {
      try {
        let sendResult: { success: boolean; messageId?: string; error?: string } = { success: false };

        if (notif.type === 'EMAIL') {
          sendResult = await notificationService.sendEmailNotification({
            type: 'EMAIL',
            userId: notif.userId,
            debtId: notif.debtId,
            debtName: notif.debt?.name || '',
            debtAmount: notif.debt?.currentPrincipal ? parseFloat(notif.debt.currentPrincipal.toString()) : 0,
            dueDate: notif.debt?.nextDueDate || new Date(),
            daysBefore: notif.daysBefore,
            recipient: {
              email: notif.recipientEmail || notif.user?.email || '',
              name: notif.user?.name || undefined,
            },
          });
        } else if (notif.type === 'WHATSAPP') {
          sendResult = await notificationService.sendWhatsAppNotification({
            type: 'WHATSAPP',
            userId: notif.userId,
            debtId: notif.debtId,
            debtName: notif.debt?.name || '',
            debtAmount: notif.debt?.currentPrincipal ? parseFloat(notif.debt.currentPrincipal.toString()) : 0,
            dueDate: notif.debt?.nextDueDate || new Date(),
            daysBefore: notif.daysBefore,
            recipient: {
              phone: notif.recipientPhone || notif.user?.phone || '',
              name: notif.user?.name || undefined,
            },
          });
        }

        // 4. Actualizar estado a SENT
        await prisma.debtNotification.update({
          where: { id: notif.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        processed.push(notif.id);
        console.log(`[Cron] ✓ Notificación ${notif.id} enviada (${notif.type})`);
      } catch (error) {
        console.error(`[Cron] ✗ Error al enviar notificación ${notif.id}:`, error);

        // Marcar como FAILED
        await prisma.debtNotification.update({
          where: { id: notif.id },
          data: {
            status: 'FAILED',
            failureReason:
              error instanceof Error ? error.message : 'Error desconocido',
          },
        });

        failed.push(notif.id);
      }
    }

    return {
      processed: processed.length,
      failed: failed.length,
    };
  } catch (error) {
    console.error('[Cron] Error fatal:', error);
    throw error;
  }
}
