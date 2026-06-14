import {
  addDays,
  addMonths,
  getDaysInMonth,
  startOfMonth,
  differenceInCalendarDays,
  format,
} from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreditCardInput {
  id: string;
  bankName: string;
  cardName: string;
  last4Digits: string;
  closingDay: number;
  dueDay: number;
}

export type AlertLevel =
  | "overdue"
  | "pay_today"
  | "warning_d1"
  | "warning_d3"
  | "warning_d7"
  | "risk_zone"
  | "best_moment"
  | "normal";

export type InsightType = "critical" | "warning" | "opportunity" | "info";

export interface CardCalendarEntry {
  id: string;
  label: string;
  bankName: string;
  cardName: string;
  last4Digits: string;
  closingDay: number;
  dueDay: number;
  nextClosingDate: string;
  pendingDueDate: string;
  nextDueDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  bestWindowStart: string;
  bestWindowEnd: string;
  riskWindowStart: string;
  riskWindowEnd: string;
  alertLevel: AlertLevel;
  alertSeverity: InsightType;
  daysToDue: number;
  adviceMicrocopy: string;
  adviceDetail: string;
}

export type CalendarEventType =
  | "closing"
  | "payment_due"
  | "best_window"
  | "risk_window";

export interface CalendarEvent {
  date: string;
  type: CalendarEventType;
  cardLabel: string;
  last4Digits: string;
  bankName: string;
  description: string;
}

export interface MonthCalendar {
  year: number;
  month: number;
  monthLabel: string;
  events: CalendarEvent[];
}

export interface CreditAdvisorAlert {
  bankName: string;
  last4Digits: string;
  cardLabel: string;
  alertLevel: AlertLevel;
  severity: InsightType;
  message: string;
  dueDate: string;
  daysToDue: number;
}

export interface CreditAdvisorRecommendation {
  bankName: string;
  last4Digits: string;
  cardLabel: string;
  type: InsightType;
  title: string;
  description: string;
}

export interface CreditCardCalendarResult {
  today: string;
  alerts: CreditAdvisorAlert[];
  recommendations: CreditAdvisorRecommendation[];
  calendar: MonthCalendar[];
  cards: CardCalendarEntry[];
  emptyState?: boolean;
}

// ─── Date utilities ───────────────────────────────────────────────────────────

function safeDate(year: number, month: number, day: number): Date {
  const max = getDaysInMonth(new Date(year, month, 1));
  return new Date(year, month, Math.min(day, max));
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function nextClosingOnOrAfter(closingDay: number, from: Date): Date {
  const y = from.getFullYear();
  const mo = from.getMonth();
  const d = from.getDate();
  const candidate = safeDate(y, mo, closingDay);
  if (candidate.getDate() >= d) return candidate;
  const nm = addMonths(new Date(y, mo, 1), 1);
  return safeDate(nm.getFullYear(), nm.getMonth(), closingDay);
}

function prevClosingFrom(closingDay: number, nextClosing: Date): Date {
  const pm = addMonths(startOfMonth(nextClosing), -1);
  return safeDate(pm.getFullYear(), pm.getMonth(), closingDay);
}

// dueDay > closingDay → same month as closing
// dueDay <= closingDay → next month after closing
function dueAfterClosing(closing: Date, closingDay: number, dueDay: number): Date {
  if (dueDay > closingDay) {
    return safeDate(closing.getFullYear(), closing.getMonth(), dueDay);
  }
  const nm = addMonths(startOfMonth(closing), 1);
  return safeDate(nm.getFullYear(), nm.getMonth(), dueDay);
}

// ─── Alert helpers ────────────────────────────────────────────────────────────

function getAlertLevel(
  daysToDue: number,
  today: Date,
  riskStart: Date,
  riskEnd: Date,
  bestStart: Date,
  bestEnd: Date
): AlertLevel {
  if (daysToDue < 0) return "overdue";
  if (daysToDue === 0) return "pay_today";
  if (daysToDue === 1) return "warning_d1";
  if (daysToDue <= 3) return "warning_d3";
  if (daysToDue <= 7) return "warning_d7";
  if (today >= riskStart && today <= riskEnd) return "risk_zone";
  if (today >= bestStart && today <= bestEnd) return "best_moment";
  return "normal";
}

const SEVERITY: Record<AlertLevel, InsightType> = {
  overdue: "critical",
  pay_today: "critical",
  warning_d1: "warning",
  warning_d3: "warning",
  warning_d7: "warning",
  risk_zone: "warning",
  best_moment: "opportunity",
  normal: "info",
};

function microcopy(level: AlertLevel, days: number): string {
  switch (level) {
    case "overdue":      return "Pago vencido";
    case "pay_today":    return "Paga hoy";
    case "warning_d1":   return "Paga mañana";
    case "warning_d3":   return `Pago en ${days} días`;
    case "warning_d7":   return "Prepara pago";
    case "risk_zone":    return "Evita nuevos cargos";
    case "best_moment":  return "Mejor momento para consumir";
    default:             return "Al corriente";
  }
}

function detail(
  level: AlertLevel,
  dueFmt: string,
  days: number,
  bestEndFmt: string,
  closingFmt: string
): string {
  switch (level) {
    case "overdue":
      return `La fecha límite del ${dueFmt} ya venció. Paga cuanto antes para evitar intereses.`;
    case "pay_today":
      return `Hoy es tu fecha límite de pago. Realiza tu pago antes de que termine el día.`;
    case "warning_d1":
      return `Mañana vence tu fecha límite de pago. Prepara tu transferencia hoy.`;
    case "warning_d3":
      return `Tu fecha límite de pago es el ${dueFmt}, en ${days} días.`;
    case "warning_d7":
      return `Tu fecha límite de pago es el ${dueFmt}. Planifica tu pago esta semana.`;
    case "risk_zone":
      return `El corte se acerca el ${closingFmt}. Nuevos cargos aparecerán en este estado y deberás pagarlos pronto.`;
    case "best_moment":
      return `Consume antes del ${bestEndFmt} para maximizar el plazo y tener el mayor tiempo posible para pagar.`;
    default:
      return `Estás al corriente. Tu próximo pago vence el ${dueFmt}.`;
  }
}

// ─── Calendar builder ─────────────────────────────────────────────────────────

function buildMonthCalendars(
  today: Date,
  months: number,
  cards: CardCalendarEntry[]
): MonthCalendar[] {
  const result: MonthCalendar[] = [];

  for (let m = 0; m < months; m++) {
    const base = addMonths(startOfMonth(today), m);
    const year = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = getDaysInMonth(base);
    const raw = format(base, "MMMM yyyy", { locale: es });
    const monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);

    const seen = new Set<string>();
    const events: CalendarEvent[] = [];

    function push(e: CalendarEvent) {
      const key = `${e.date}:${e.type}:${e.last4Digits}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push(e);
    }

    for (const card of cards) {
      const lbl = card.label;
      const cd = card.closingDay;
      const dd = card.dueDay;

      // Closing this month
      const closingDay = Math.min(cd, daysInMonth);
      const closingDate = new Date(year, month, closingDay);
      push({ date: isoDate(closingDate), type: "closing", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Fecha de corte" });

      // Due day this month
      const dueDayThisMonth = Math.min(dd, daysInMonth);
      push({ date: isoDate(new Date(year, month, dueDayThisMonth)), type: "payment_due", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Fecha límite de pago" });

      // Best window: D+1 to D+7 after this month's closing
      for (let d = 1; d <= 7; d++) {
        const bw = addDays(closingDate, d);
        if (bw.getMonth() === month && bw.getFullYear() === year) {
          push({ date: isoDate(bw), type: "best_window", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Mejor consumo" });
        }
      }

      // Best window overflow from prev month's closing
      const prevBase = addMonths(base, -1);
      const prevDIM = getDaysInMonth(prevBase);
      const prevClosingDate = new Date(prevBase.getFullYear(), prevBase.getMonth(), Math.min(cd, prevDIM));
      for (let d = 1; d <= 7; d++) {
        const bw = addDays(prevClosingDate, d);
        if (bw.getMonth() === month && bw.getFullYear() === year) {
          push({ date: isoDate(bw), type: "best_window", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Mejor consumo" });
        }
      }

      // Risk window: D-7 to D-1 before this month's closing
      for (let d = -7; d <= -1; d++) {
        const rw = addDays(closingDate, d);
        if (rw.getMonth() === month && rw.getFullYear() === year) {
          push({ date: isoDate(rw), type: "risk_window", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Evitar consumo" });
        }
      }

      // Risk window overflow from next month's closing
      const nextBase = addMonths(base, 1);
      const nextDIM = getDaysInMonth(nextBase);
      const nextClosingDate = new Date(nextBase.getFullYear(), nextBase.getMonth(), Math.min(cd, nextDIM));
      for (let d = -7; d <= -1; d++) {
        const rw = addDays(nextClosingDate, d);
        if (rw.getMonth() === month && rw.getFullYear() === year) {
          push({ date: isoDate(rw), type: "risk_window", cardLabel: lbl, last4Digits: card.last4Digits, bankName: card.bankName, description: "Evitar consumo" });
        }
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    result.push({ year, month, monthLabel, events });
  }

  return result;
}

function emptyCalendar(today: Date, months: number): MonthCalendar[] {
  return Array.from({ length: months }, (_, m) => {
    const base = addMonths(startOfMonth(today), m);
    const raw = format(base, "MMMM yyyy", { locale: es });
    return {
      year: base.getFullYear(),
      month: base.getMonth(),
      monthLabel: raw.charAt(0).toUpperCase() + raw.slice(1),
      events: [],
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BuildCalendarOptions {
  months?: number;
  referenceDate?: Date;
}

export function buildCreditCardCalendar(
  cards: CreditCardInput[],
  options: BuildCalendarOptions = {}
): CreditCardCalendarResult {
  const { months = 3 } = options;
  const ref = options.referenceDate ?? new Date();
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const todayStr = isoDate(today);

  const creditCards = cards.filter(c => c.closingDay > 0 && c.dueDay > 0);

  if (creditCards.length === 0) {
    return { today: todayStr, alerts: [], recommendations: [], calendar: emptyCalendar(today, months), cards: [], emptyState: true };
  }

  const entries: CardCalendarEntry[] = creditCards.map(card => {
    const { closingDay, dueDay } = card;
    const label = `${card.bankName} •••• ${card.last4Digits}`;

    const nextClosing = nextClosingOnOrAfter(closingDay, today);
    const prevClosing = prevClosingFrom(closingDay, nextClosing);

    const pendingDue   = dueAfterClosing(prevClosing, closingDay, dueDay);
    const nextDue      = dueAfterClosing(nextClosing,  closingDay, dueDay);
    const periodStart  = addDays(prevClosing, 1);
    const bestWinStart = addDays(prevClosing, 1);
    const bestWinEnd   = addDays(prevClosing, 7);
    const riskWinStart = addDays(nextClosing, -7);
    const riskWinEnd   = nextClosing;

    const daysToDue = differenceInCalendarDays(pendingDue, today);
    const level     = getAlertLevel(daysToDue, today, riskWinStart, riskWinEnd, bestWinStart, bestWinEnd);
    const severity  = SEVERITY[level];

    const fmtDue     = format(pendingDue, "d 'de' MMMM", { locale: es });
    const fmtBestEnd = format(bestWinEnd, "d 'de' MMMM", { locale: es });
    const fmtClosing = format(nextClosing, "d 'de' MMMM", { locale: es });

    return {
      id: card.id,
      label,
      bankName:   card.bankName,
      cardName:   card.cardName,
      last4Digits: card.last4Digits,
      closingDay,
      dueDay,
      nextClosingDate:    isoDate(nextClosing),
      pendingDueDate:     isoDate(pendingDue),
      nextDueDate:        isoDate(nextDue),
      currentPeriodStart: isoDate(periodStart),
      currentPeriodEnd:   isoDate(nextClosing),
      bestWindowStart:    isoDate(bestWinStart),
      bestWindowEnd:      isoDate(bestWinEnd),
      riskWindowStart:    isoDate(riskWinStart),
      riskWindowEnd:      isoDate(riskWinEnd),
      alertLevel:         level,
      alertSeverity:      severity,
      daysToDue,
      adviceMicrocopy:    microcopy(level, daysToDue),
      adviceDetail:       detail(level, fmtDue, daysToDue, fmtBestEnd, fmtClosing),
    };
  });

  const alerts: CreditAdvisorAlert[] = entries
    .filter(e => ["overdue", "pay_today", "warning_d1", "warning_d3", "warning_d7"].includes(e.alertLevel))
    .sort((a, b) => a.daysToDue - b.daysToDue)
    .map(e => ({
      bankName:    e.bankName,
      last4Digits: e.last4Digits,
      cardLabel:   e.label,
      alertLevel:  e.alertLevel,
      severity:    e.alertSeverity,
      message:     e.adviceDetail,
      dueDate:     e.pendingDueDate,
      daysToDue:   e.daysToDue,
    }));

  const recommendations: CreditAdvisorRecommendation[] = entries.map(e => ({
    bankName:    e.bankName,
    last4Digits: e.last4Digits,
    cardLabel:   e.label,
    type:        e.alertSeverity,
    title:       e.adviceMicrocopy,
    description: e.adviceDetail,
  }));

  return {
    today: todayStr,
    alerts,
    recommendations,
    calendar: buildMonthCalendars(today, months, entries),
    cards: entries,
  };
}
