/**
 * Analytics para el módulo de Deudas y Préstamos
 * Eventos de seguimiento sin exponer datos sensibles (IDs, montos exactos, nombres de contrapartes)
 */

export type DebtEventType =
  | 'debt_created'
  | 'debt_edited'
  | 'debt_deleted'
  | 'debt_payment_recorded'
  | 'debt_payment_edited'
  | 'debt_payment_deleted'
  | 'debt_marked_paid_off'
  | 'debt_installment_generated'
  | 'debt_transaction_linked'
  | 'debt_notification_sent'
  | 'debt_filter_used';

export type AmountBucket = '0-1000' | '1000-5000' | '5000-20000' | '20000-100000' | '100000+';
export type DebtDirection = 'PAYABLE' | 'RECEIVABLE';
export type DebtType =
  | 'PERSONAL_LOAN'
  | 'CREDIT_CARD'
  | 'AUTO_LOAN'
  | 'MORTGAGE'
  | 'BNPL'
  | 'FAMILY_LOAN'
  | 'LOAN_GRANTED'
  | 'OTHER';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'CHECK' | 'OTHER';
export type DebtPaymentPortion = 'capital' | 'interest' | 'fees' | 'penalties';

export interface DebtEventPayload {
  // Evento
  event: DebtEventType;

  // Metadatos generales
  timestamp?: string;

  // debt_created
  direction?: DebtDirection;
  type?: DebtType;
  amount_bucket?: AmountBucket;

  // debt_edited
  field_changed?: string; // "balance" | "rate" | "dueDate" | etc.

  // debt_deleted
  reason?: string; // Si el usuario proporcionó motivo

  // debt_payment_recorded / debt_payment_edited / debt_payment_deleted
  payment_method?: PaymentMethod;
  portion?: DebtPaymentPortion; // Qué componente del pago (capital, interés, etc.)

  // debt_marked_paid_off
  days_to_liquidate?: number;

  // debt_installment_generated
  number_of_installments?: number;
  frequency?: string; // "MONTHLY" | "BIWEEKLY" | etc.

  // debt_transaction_linked
  transaction_amount?: number; // Para análisis, pero sin exponer montos exactos
  partial?: boolean; // ¿Se vinculó solo parte de la transacción?

  // debt_filter_used
  filter_type?: string; // "direction" | "status" | "type" | "search" | "dateRange"
  filter_value?: string; // Valor sanitizado del filtro
}

/**
 * Calcula el bucket de monto para anonimizar
 */
export function getAmountBucket(amount: number): AmountBucket {
  if (amount <= 1000) return '0-1000';
  if (amount <= 5000) return '1000-5000';
  if (amount <= 20000) return '5000-20000';
  if (amount <= 100000) return '20000-100000';
  return '100000+';
}

/**
 * Dispara evento de analytics para deudas
 * Usa Google Analytics 4 si está disponible (gtag)
 *
 * Ejemplo:
 * trackDebtEvent('debt_created', {
 *   direction: 'PAYABLE',
 *   type: 'CREDIT_CARD',
 *   amount_bucket: '5000-20000'
 * });
 */
export function trackDebtEvent(eventType: DebtEventType, payload: Omit<DebtEventPayload, 'event'> = {}) {
  const fullPayload: DebtEventPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', eventType, {
        // Envía solo los campos del payload (excepto timestamp que GA maneja automáticamente)
        ...Object.fromEntries(
          Object.entries(fullPayload).filter(([key]) => key !== 'event' && key !== 'timestamp')
        ),
      });
    } catch (error) {
      console.warn('[Analytics] Error tracking debt event:', error);
    }
  }

  // Logging local en desarrollo
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', fullPayload);
  }
}
