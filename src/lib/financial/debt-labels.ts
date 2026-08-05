/**
 * Diccionario centralizado de etiquetas para el módulo de Deudas
 * Traduce enums internos a etiquetas amigables para el usuario
 */

export const DEBT_TYPE_LABELS: Record<string, string> = {
  PERSONAL_LOAN: "Préstamo personal",
  CREDIT_CARD: "Tarjeta de crédito",
  AUTO_LOAN: "Crédito automotriz",
  MORTGAGE: "Hipoteca",
  BNPL: "Compra a plazos",
  FAMILY_LOAN: "Préstamo familiar",
  LOAN_GRANTED: "Préstamo otorgado",
  OTHER: "Otro",
};

export const DEBT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PAID_OFF: "Liquidada",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  DEFAULTED: "En incumplimiento",
};

export const DEBT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAID_OFF: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  DEFAULTED: "bg-red-100 text-red-800",
};

export const DEBT_DIRECTION_LABELS: Record<string, string> = {
  PAYABLE: "Por pagar",
  RECEIVABLE: "Por cobrar",
};

export const DEBT_SCHEDULE_MODE_LABELS: Record<string, string> = {
  FREE: "Seguimiento libre",
  INSTALLMENTS: "Calendario de cuotas",
};

export const DEBT_INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

export const DEBT_INSTALLMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

/**
 * Obtener etiqueta traducida o devolver valor original como fallback
 */
export function getDebtTypeLabel(type: string): string {
  return DEBT_TYPE_LABELS[type] || type;
}

export function getDebtStatusLabel(status: string): string {
  return DEBT_STATUS_LABELS[status] || status;
}

export function getDebtDirectionLabel(direction: string): string {
  return DEBT_DIRECTION_LABELS[direction] || direction;
}

export function getDebtScheduleModeLabel(mode: string): string {
  return DEBT_SCHEDULE_MODE_LABELS[mode] || mode;
}

export function getDebtInstallmentStatusLabel(status: string): string {
  return DEBT_INSTALLMENT_STATUS_LABELS[status] || status;
}
