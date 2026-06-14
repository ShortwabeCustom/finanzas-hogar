"use client";

import { useState, useMemo } from "react";
import { getDaysInMonth } from "date-fns";
import { MonthCalendar, CalendarEvent, CalendarEventType } from "@/lib/financial/credit-card-calendar";

// ─── Card filter chip ─────────────────────────────────────────────────────────

interface CardOption {
  key: string; // `${bankName}-${last4Digits}`
  label: string; // "BBVA 1234"
}

function CardFilterChips({
  options,
  selected,
  onChange,
}: {
  options: CardOption[];
  selected: string | null;
  onChange: (key: string | null) => void;
}) {
  if (options.length <= 1) return null; // No point filtering a single card

  return (
    <div
      className="flex flex-wrap gap-2 mb-4"
      role="group"
      aria-label="Filtrar calendario por tarjeta"
    >
      <button
        onClick={() => onChange(null)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          selected === null
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
        }`}
        aria-pressed={selected === null}
      >
        Todas
      </button>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(selected === opt.key ? null : opt.key)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === opt.key
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
          aria-pressed={selected === opt.key}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Config ────────────────────────────────────────────────────────────────────

const EVENT_CFG: Record<CalendarEventType, { dot: string; label: string; bg: string; text: string }> = {
  closing:      { dot: "bg-purple-500", label: "Corte",              bg: "bg-purple-50",  text: "text-purple-700" },
  payment_due:  { dot: "bg-red-500",    label: "Fecha límite pago",  bg: "bg-red-50",     text: "text-red-700" },
  best_window:  { dot: "bg-green-500",  label: "Mejor consumo",      bg: "bg-green-50",   text: "text-green-700" },
  risk_window:  { dot: "bg-amber-500",  label: "Evitar consumo",     bg: "bg-amber-50",   text: "text-amber-700" },
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

// ─── Helper ────────────────────────────────────────────────────────────────────

function formatDateLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ─── Month grid ───────────────────────────────────────────────────────────────

function MonthGrid({ cal, today }: { cal: MonthCalendar; today: string }) {
  const daysInMonth = getDaysInMonth(new Date(cal.year, cal.month, 1));
  const firstDow = new Date(cal.year, cal.month, 1).getDay();

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const e of cal.events) {
      const day = parseInt(e.date.slice(8), 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return map;
  }, [cal.events]);

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayDate = parseInt(today.slice(8), 10);
  const isCurrentMonth =
    today.slice(0, 7) === `${String(cal.year)}-${String(cal.month + 1).padStart(2, "0")}`;

  return (
    <div>
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;

          const events = eventsByDay.get(day) ?? [];
          const isToday = isCurrentMonth && day === todayDate;

          const uniqueTypes = [...new Set(events.map(e => e.type))];
          // Priority: payment_due > closing > risk_window > best_window
          const priority: CalendarEventType[] = ["payment_due", "closing", "risk_window", "best_window"];
          const sortedTypes = uniqueTypes.sort((a, b) => priority.indexOf(a) - priority.indexOf(b));

          // Cell background based on most important event
          let cellBg = "";
          if (uniqueTypes.includes("payment_due")) cellBg = "bg-red-50";
          else if (uniqueTypes.includes("closing")) cellBg = "bg-purple-50";
          else if (uniqueTypes.includes("risk_window")) cellBg = "bg-amber-50";
          else if (uniqueTypes.includes("best_window")) cellBg = "bg-green-50";

          const label = events.map(e => `${EVENT_CFG[e.type].label}: ${e.cardLabel}`).join("; ");

          return (
            <div
              key={day}
              className={`aspect-square flex flex-col items-center justify-start pt-1 rounded-lg ${cellBg} ${isToday ? "ring-2 ring-indigo-500 ring-inset" : ""}`}
              title={label || undefined}
              aria-label={label ? `${day}: ${label}` : String(day)}
            >
              <span
                className={`text-xs leading-none font-medium ${
                  isToday
                    ? "text-indigo-700 font-bold"
                    : events.length > 0
                    ? "text-gray-800"
                    : "text-gray-400"
                }`}
              >
                {day}
              </span>
              {sortedTypes.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {sortedTypes.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className={`w-1.5 h-1.5 rounded-full ${EVENT_CFG[t].dot}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mobile event list ────────────────────────────────────────────────────────

function EventList({ calendars, today }: { calendars: MonthCalendar[]; today: string }) {
  const upcoming = useMemo(() => {
    return calendars
      .flatMap(m => m.events)
      .filter(e => e.date >= today && (e.type === "closing" || e.type === "payment_due"))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 15);
  }, [calendars, today]);

  if (upcoming.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">Sin eventos próximos</p>;
  }

  return (
    <ul className="divide-y divide-gray-100" aria-label="Próximos eventos de tarjetas">
      {upcoming.map((e, i) => {
        const cfg = EVENT_CFG[e.type];
        return (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <div className="flex-shrink-0 w-10 text-center">
              <span className="text-xs text-gray-500 font-medium">{formatDateLabel(e.date)}</span>
            </div>
            <span className={`flex-shrink-0 w-2 h-2 rounded-full ${cfg.dot}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</p>
              <p className="text-xs text-gray-500 truncate">{e.cardLabel}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100" aria-label="Leyenda del calendario">
      {(Object.entries(EVENT_CFG) as [CalendarEventType, typeof EVENT_CFG[CalendarEventType]][]).map(([type, cfg]) => (
        <div key={type} className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
          <span className="text-xs text-gray-500">{cfg.label}</span>
        </div>
      ))}
    </div>
  );
}

function SkeletonCalendar() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 rounded w-28" />
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  calendars: MonthCalendar[];
  today: string;
  loading?: boolean;
}

export default function CreditCalendar({ calendars, today, loading }: Props) {
  const [monthIdx, setMonthIdx] = useState(0);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Derive unique card options from all events across all months
  const cardOptions = useMemo<CardOption[]>(() => {
    const seen = new Map<string, string>();
    for (const m of calendars) {
      for (const e of m.events) {
        const key = `${e.bankName}-${e.last4Digits}`;
        if (!seen.has(key)) {
          seen.set(key, `${e.bankName} ${e.last4Digits}`);
        }
      }
    }
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [calendars]);

  // Filter events for the active month by selected card
  const filteredCal = useMemo<MonthCalendar | undefined>(() => {
    const cal = calendars[monthIdx];
    if (!cal) return undefined;
    if (!selectedCard) return cal;
    return {
      ...cal,
      events: cal.events.filter(
        e => `${e.bankName}-${e.last4Digits}` === selectedCard
      ),
    };
  }, [calendars, monthIdx, selectedCard]);

  // Filtered calendars for the mobile list (all months, selected card)
  const filteredAllCals = useMemo<MonthCalendar[]>(() => {
    if (!selectedCard) return calendars;
    return calendars.map(m => ({
      ...m,
      events: m.events.filter(
        e => `${e.bankName}-${e.last4Digits}` === selectedCard
      ),
    }));
  }, [calendars, selectedCard]);

  return (
    <div>
      {/* Card filter chips */}
      {!loading && (
        <CardFilterChips
          options={cardOptions}
          selected={selectedCard}
          onChange={setSelectedCard}
        />
      )}

      {/* Month navigation */}
      {calendars.length > 1 && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setMonthIdx(i => Math.max(0, i - 1))}
            disabled={monthIdx === 0}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Mes anterior"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-semibold text-gray-700 capitalize">
            {filteredCal?.monthLabel ?? "—"}
          </span>
          <button
            onClick={() => setMonthIdx(i => Math.min(calendars.length - 1, i + 1))}
            disabled={monthIdx === calendars.length - 1}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Mes siguiente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Desktop: grid view */}
      <div className="hidden sm:block">
        {loading || !filteredCal ? (
          <SkeletonCalendar />
        ) : (
          <MonthGrid cal={filteredCal} today={today} />
        )}
      </div>

      {/* Mobile: list view */}
      <div className="sm:hidden">
        {loading ? (
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 rounded-lg" />
            ))}
          </div>
        ) : (
          <EventList calendars={filteredAllCals} today={today} />
        )}
      </div>

      {/* Legend */}
      {!loading && <Legend />}
    </div>
  );
}
