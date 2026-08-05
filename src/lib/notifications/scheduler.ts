import { prisma } from '@/lib/prisma';
import { NotificationService } from './notification-service';
import { trackDebtEvent } from '@/lib/analytics';

/**
 * Process pending notifications and send them
 * Run every hour via external scheduler (n8n, cron, etc.)
 * Or use Vercel Cron (app/api/cron/send-debt-notifications/route.ts)
 */
export async function processPendingNotifications(): Promise<{ processed: number; failed: number }> {
  const service = new NotificationService();
  let processed = 0;
  let failed = 0;

  const pending = await prisma.debtNotification.findMany({
    where: {
      status: 'PENDING',
      nextRetryAt: { lte: new Date() },
    },
    include: { user: true, debt: true },
    take: 100, // Batch size
  });

  for (const notification of pending) {
    try {
      let result;
      const notificationType = notification.type as 'EMAIL' | 'WHATSAPP';
      const payload = {
        type: notificationType,
        userId: notification.userId,
        debtId: notification.debtId,
        debtName: notification.debt?.name || 'Unknown Debt',
        debtAmount: notification.debt?.currentPrincipal.toNumber() || 0,
        dueDate: notification.dueDate,
        daysBefore: notification.daysBefore,
        recipient: {
          email: notification.recipientEmail || notification.user?.email,
          phone: notification.recipientPhone || undefined,
          name: notification.user?.name || undefined,
        },
      };

      if (notificationType === 'EMAIL') {
        result = await service.sendEmailNotification(payload);
      } else if (notificationType === 'WHATSAPP') {
        result = await service.sendWhatsAppNotification(payload);
      } else {
        throw new Error(`Unsupported notification type: ${notificationType}`);
      }

      if (result.success) {
        await prisma.debtNotification.update({
          where: { id: notification.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            externalId: result.messageId,
            retryCount: 0,
          },
        });

        trackDebtEvent('debt_notification_sent');

        processed++;
      } else {
        // Retry logic
        const nextRetryAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min later
        if (notification.retryCount < notification.maxRetries) {
          await prisma.debtNotification.update({
            where: { id: notification.id },
            data: {
              status: 'PENDING',
              retryCount: notification.retryCount + 1,
              lastRetryAt: new Date(),
              nextRetryAt,
              failureReason: result.error,
            },
          });
        } else {
          await prisma.debtNotification.update({
            where: { id: notification.id },
            data: {
              status: 'FAILED',
              failureReason: `Max retries exceeded: ${result.error}`,
            },
          });
        }
        failed++;
      }
    } catch (error) {
      console.error('[Notification Scheduler]', error);
      failed++;

      // Mark as failed if unrecoverable
      await prisma.debtNotification.update({
        where: { id: notification.id },
        data: {
          status: 'FAILED',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      }).catch(e => console.error('[Notification Update]', e));
    }
  }

  return { processed, failed };
}

/**
 * Schedule notifications for upcoming due dates
 * Should be called when a new debt or installment is created
 */
export async function scheduleNotificationsForDebt(
  debtId: string,
  dueDate: Date,
  userId: string,
  daysBefore: number[] = [3]
): Promise<void> {
  const debt = await prisma.debtAccount.findUnique({
    where: { id: debtId },
    select: { name: true, currentPrincipal: true },
  });

  if (!debt) {
    throw new Error(`Debt not found: ${debtId}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Schedule EMAIL notification (default)
  for (const days of daysBefore) {
    const nextRetryAt = new Date(dueDate);
    nextRetryAt.setDate(nextRetryAt.getDate() - days);

    // Check if notification already exists
    const existing = await prisma.debtNotification.findFirst({
      where: {
        debtId,
        userId,
        type: 'EMAIL',
        daysBefore: days,
      },
    });

    if (!existing) {
      await prisma.debtNotification.create({
        data: {
          userId,
          debtId,
          type: 'EMAIL',
          status: 'PENDING',
          subject: `Deuda próxima a vencer: ${debt.name}`,
          message: `Tu deuda "${debt.name}" vence en ${days} días. Monto: $${debt.currentPrincipal}`,
          recipientEmail: user.email,
          dueDate,
          daysBefore: days,
          nextRetryAt,
        },
      });
    }
  }
}
