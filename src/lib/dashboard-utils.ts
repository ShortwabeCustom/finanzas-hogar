// Shared utilities used by both the shared and personal dashboard API routes.

export const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const DAY_NAMES = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayLabel(d: Date): string {
  return `${DAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}`;
}

export function daysDiff(from: Date, to: Date): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function isReceivedCategory(name: string): boolean {
  const n = normalizeText(name);
  return n.includes("deposito") || n.includes("abono") || n.includes("transferencias recibidas");
}

export function isSavingsCategory(name: string): boolean {
  return normalizeText(name).includes("ahorro");
}

export type FlowGranularity = "day" | "week" | "month";

export interface FlowRow {
  label: string;
  spent: number;
  received: number;
}

export function buildFlowAgg(from: Date, to: Date, granularity: FlowGranularity): Map<string, FlowRow> {
  const flowAgg = new Map<string, FlowRow>();

  if (granularity === "day") {
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const dayEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    while (cursor <= dayEnd) {
      flowAgg.set(dayKey(cursor), { label: dayLabel(cursor), spent: 0, received: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === "week") {
    const totalWeeks = Math.ceil((daysDiff(from, to) + 1) / 7);
    for (let week = 1; week <= totalWeeks; week++) {
      flowAgg.set(`w${week}`, { label: `Sem ${week}`, spent: 0, received: 0 });
    }
  } else {
    const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cursor <= end) {
      flowAgg.set(monthKey(cursor), { label: monthLabel(cursor), spent: 0, received: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return flowAgg;
}

export function flowKey(date: Date, from: Date, granularity: FlowGranularity): string {
  if (granularity === "day") return dayKey(date);
  if (granularity === "week") return `w${Math.floor(daysDiff(from, date) / 7) + 1}`;
  return monthKey(date);
}
