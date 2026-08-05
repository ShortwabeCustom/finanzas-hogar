import { NextRequest, NextResponse } from 'next/server';
import { processPendingNotifications } from '@/lib/notifications/cron-processor';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 segundos máximo

export async function POST(req: NextRequest) {
  // Verificar autenticación con Vercel CRON_SECRET
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const expectedToken = process.env.CRON_SECRET;

  if (!token || !expectedToken || token !== expectedToken) {
    console.warn('[Cron] ✗ Acceso no autorizado - Token inválido o faltante');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Iniciando procesamiento de notificaciones en', new Date().toISOString());

    const result = await processPendingNotifications();

    console.log('[Cron] Completado:', result);

    return NextResponse.json(
      {
        success: true,
        processed: result.processed,
        failed: result.failed,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
