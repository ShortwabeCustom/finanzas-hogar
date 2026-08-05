import { prisma } from '@/lib/prisma';

export interface NotificationPayload {
  type: 'EMAIL' | 'WHATSAPP';
  userId: string;
  debtId: string;
  debtName: string;
  debtAmount: number;
  dueDate: Date;
  daysBefore: number;
  recipient: {
    email?: string;
    phone?: string;
    name?: string;
  };
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class NotificationService {
  async sendEmailNotification(payload: NotificationPayload): Promise<SendResult> {
    // Stub: Ready for SendGrid integration
    // TODO: Implement SendGrid integration
    console.log('[Notification - Email]', payload);

    if (!payload.recipient.email) {
      return { success: false, error: 'Email recipient not provided' };
    }

    // Placeholder implementation
    return { success: true, messageId: `email-${Date.now()}` };
  }

  async sendWhatsAppNotification(payload: NotificationPayload): Promise<SendResult> {
    // Stub: Ready for Twilio integration
    // TODO: Implement Twilio WhatsApp integration
    console.log('[Notification - WhatsApp]', payload);

    if (!payload.recipient.phone) {
      return { success: false, error: 'Phone recipient not provided' };
    }

    // Placeholder implementation
    return { success: true, messageId: `wa-${Date.now()}` };
  }

  async scheduleNotifications(): Promise<void> {
    // SCHEDULED TASK: Run every hour
    // 1. Find all PENDING notifications where nextRetryAt ≤ now
    // 2. Send via appropriate provider
    // 3. Update status (SENT | FAILED + nextRetryAt)
    // This is implemented in scheduler.ts
  }

  async cancelNotification(notificationId: string): Promise<void> {
    await prisma.debtNotification.update({
      where: { id: notificationId },
      data: { status: 'CANCELLED' },
    });
  }

  async getNotificationHistory(userId: string, limit: number = 20): Promise<any[]> {
    return prisma.debtNotification.findMany({
      where: { userId },
      include: { debt: { select: { name: true, currentPrincipal: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
