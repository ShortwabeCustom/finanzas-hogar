"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend,
  ReferenceLine,
  LineChart,
  Line,
  ReferenceArea,
} from "recharts";
import Header from "@/components/layout/Header";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type {
  RecoveryPlan,
  FinancialStatus,
  FinancialScore,
  PaymentPlanItem,
  CutSuggestion,
  RecoveryInsight,
  ForecastData,
  SnapshotPoint,
} from "@/lib/financial/recovery-plan";

// ─── Status financiero ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FinancialStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  critical: { label: "Crítico",    bg: "bg-red-100",   text: "text-red-800",   dot: "bg-red-500"   },
  tight:    { label: "Ajustado",   bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500" },
  stable:   { label: "Estable",    bg: "bg-blue-100",  text: "text-blue-800",  dot: "bg-blue-500"  },
  healthy:  { label: "Saludable",  bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  unknown:  { label: "Sin datos",  bg: "bg-gray-100",  text: "text-gray-600",  dot: "bg-gray-400"  },
};

const INSIGHT_CONFIG: Record<
  RecoveryInsight["type"],
  { border: string; bg: string; icon: string; iconColor: string }
> = {
  risk:        { border: "border-red-200",     bg: "bg-red-50",     icon: "⚠", iconColor: "text-red-600"     },
  warning:     { border: "border-amber-200",   bg: "bg-amber-50",   icon: "!",  iconColor: "text-amber-600"   },
  opportunity: { border: "border-emerald-200", bg: "bg-emerald-50", icon: "↑",  iconColor: "text-emerald-600" },
  info:        { border: "border-blue-200",    bg: "bg-blue-50",    icon: "i",  iconColor: "text-blue-600"    },
};

const PRIORITY_CONFIG: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-red-600",    text: "text-white"     },
  2: { bg: "bg-red-500",    text: "text-white"     },
  3: { bg: "bg-amber-500",  text: "text-white"     },
  4: { bg: "bg-amber-400",  text: "text-white"     },
  5: { bg: "bg-yellow-400", text: "text-gray-900"  },
};

// ─── Score config ─────────────────────────────────────────────────────────────

const SCORE_COLOR_MAP: Record<
  FinancialScore["colorKey"],
  { bar: string; text: string; bg: string; border: string }
> = {
  green:  { bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  blue:   { bar: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200"    },
  yellow: { bar: "bg-yellow-400",  text: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-200"  },
  orange: { bar: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200"  },
  red:    { bar: "bg-red-500",     text: "text-red-700",     bg: "bg-red-50",      border: "border-red-200"     },
  gray:   { bar: "bg-gray-400",    text: "text-gray-600",    bg: "bg-gray-50",     border: "border-gray-200"    },
};

const TREND_ICONS: Record<
  FinancialScore["trend"],
  { icon: string; color: string }
> = {
  up:      { icon: "↑", color: "text-emerald-600" },
  down:    { icon: "↓", color: "text-red-500"      },
  stable:  { icon: "→", color: "text-gray-500"     },
  unknown: { icon: "—", color: "text-gray-400"     },
};

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortField = "priority" | "amount" | "dueDate";
type SortDir = "asc" | "desc";

function sortPlan(items: PaymentPlanItem[], field: SortField, dir: SortDir): PaymentPlanItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === "priority") {
      cmp = a.priority - b.priority;
    } else if (field === "amount") {
      cmp = a.amount - b.amount;
    } else if (field === "dueDate") {
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      cmp = da - db;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Components ───────────────────────────────────────────────────────────────

function getPriorityBadge(priority: number) {
  const conf = PRIORITY_CONFIG[Math.min(priority, 5)] ?? { bg: "bg-gray-200", text: "text-gray-700" };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${conf.bg} ${conf.text}`}>
      {priority}
    </span>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const active = current === field;
  return (
    <th
      className="px-4 py-3 cursor-pointer select-none group whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className={`text-[10px] transition-opacity ${active ? "opacity-100" : "opacity-30 group-hover:opacity-60"}`}>
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );
}

function fmtNull(v: number | null, label = "Dato no disponible"): string {
  if (v === null || v === undefined) return label;
  return formatCurrency(v);
}

function MiniBar({
  value,
  max,
  colorClass,
}: {
  value: number;
  max: number;
  colorClass: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-9 text-right tabular-nums shrink-0">
        {value}/{max}
      </span>
    </div>
  );
}

function ScoreWidget({
  score,
  statusConf,
}: {
  score: FinancialScore | null;
  statusConf: (typeof STATUS_CONFIG)[FinancialStatus];
}) {
  const statusBadge = (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${statusConf.bg} ${statusConf.text}`}
    >
      <span className={`w-2 h-2 rounded-full ${statusConf.dot}`} />
      {statusConf.label}
    </span>
  );

  if (!score) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-500">Estado financiero:</span>
        {statusBadge}
      </div>
    );
  }

  const col = SCORE_COLOR_MAP[score.colorKey];
  const trendConf = TREND_ICONS[score.trend];

  return (
    <div className={`card p-5 border ${col.border} ${col.bg}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        {/* Número grande + label + tendencia */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center">
            <div className={`text-4xl font-black tabular-nums leading-none ${col.text}`}>
              {score.score}
            </div>
            <div className="text-xs text-gray-400 mt-1">/ 100</div>
          </div>
          <div>
            <div className={`text-lg font-bold ${col.text}`}>{score.label}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-sm font-bold ${trendConf.color}`}>{trendConf.icon}</span>
              <span className="text-xs text-gray-500">{score.trendLabel}</span>
            </div>
            {score.confidence === "partial" && (
              <span className="text-xs text-gray-400 italic">Datos parciales</span>
            )}
          </div>
        </div>

        {/* Separador vertical */}
        <div className="hidden sm:block w-px self-stretch bg-gray-200 shrink-0" />

        {/* Barra principal + desglose */}
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-semibold text-gray-700">Score financiero</span>
              <span className="text-gray-500 tabular-nums">{score.score}/100</span>
            </div>
            <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                style={{ width: `${score.score}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
            <div>
              <div className="text-xs text-gray-500 mb-1">Flujo libre</div>
              <MiniBar value={score.breakdown.cashflow} max={40} colorClass={col.bar} />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Deuda vencida</div>
              <MiniBar value={score.breakdown.overdueDebt} max={35} colorClass={col.bar} />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Urgencia</div>
              <MiniBar value={score.breakdown.urgency} max={25} colorClass={col.bar} />
            </div>
          </div>
        </div>

        {/* Estado badge */}
        <div className="shrink-0">{statusBadge}</div>
      </div>
    </div>
  );
}

// ─── Forecast ────────────────────────────────────────────────────────────────

function ForecastSection({ forecast }: { forecast: ForecastData | null }) {
  if (!forecast) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Proyección: próximos 3 meses</h2>
        <div className="card p-6 text-center">
          <p className="text-gray-400 text-sm">Sin capacidad de pago disponible para proyectar la recuperación.</p>
        </div>
      </section>
    );
  }

  if (forecast.totalDebt === 0) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Proyección: próximos 3 meses</h2>
        <div className="card p-6 border border-emerald-200 bg-emerald-50 text-center">
          <p className="text-emerald-700 font-semibold text-sm">¡Sin deuda pendiente! Estás al corriente.</p>
          <p className="text-emerald-600 text-xs mt-1">Considera destinar {formatCurrency(forecast.monthlyPaymentCapacity)}/mes a ahorro o inversión.</p>
        </div>
      </section>
    );
  }

  const { monthsToClear, monthlyPaymentCapacity, totalDebt, projections } = forecast;

  const clearMsg =
    monthsToClear === 0
      ? "Al corriente"
      : monthsToClear === 1
        ? "Quedarías al corriente en 1 mes"
        : `Quedarías al corriente en ${monthsToClear} meses`;

  const accentColor = monthsToClear <= 3 ? "#10b981" : monthsToClear <= 6 ? "#f59e0b" : "#ef4444";

  return (
    <section>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-1 mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Proyección: próximos 3 meses</h2>
        <span
          className="text-sm font-medium"
          style={{ color: accentColor }}
        >
          {clearMsg}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Aplicando {formatCurrency(monthlyPaymentCapacity)}/mes de capacidad de pago sobre {formatCurrency(totalDebt)} de deuda total.
      </p>

      <div className="card p-6">
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={projections} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradDebt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600 }} />
            <YAxis
              tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11 }}
              width={52}
            />
            <Tooltip
              formatter={((v: unknown, name: string) => [
                formatCurrency(Number(v)),
                name === "remainingDebt" ? "Deuda restante" : "Pagos acumulados",
              ]) as any}
            />
            <Legend
              formatter={(v) => v === "remainingDebt" ? "Deuda restante" : "Pagos acumulados"}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
            {projections.some((p) => p.remainingDebt === 0) && (
              <ReferenceLine
                x={projections.find((p) => p.remainingDebt === 0)?.month}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{ value: "Al corriente", position: "insideTopRight", fontSize: 11, fill: "#10b981" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="remainingDebt"
              stroke="#ef4444"
              strokeWidth={2}
              fill="url(#gradDebt)"
              dot={{ r: 4, fill: "#ef4444", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="cumulativePaid"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#gradPaid)"
              dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {monthsToClear > 3 && (
          <p className="text-xs text-gray-400 text-center mt-3">
            La gráfica muestra los primeros 3 meses. Con este ritmo quedarías al corriente en {monthsToClear} meses en total.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Score History ────────────────────────────────────────────────────────────

const SNAPSHOT_MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmtSnapshotDate(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  return `${SNAPSHOT_MONTHS[month - 1]} ${String(year).slice(2)}`;
}

function ScoreDot(props: {
  cx?: number;
  cy?: number;
  value?: number | null;
}) {
  const { cx, cy, value } = props;
  if (value == null || cx == null || cy == null) return null;
  const color =
    value >= 80 ? "#10b981" :
    value >= 65 ? "#3b82f6" :
    value >= 45 ? "#eab308" :
    value >= 25 ? "#f97316" : "#ef4444";
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
}

function ScoreHistoryChart({ snapshots }: { snapshots: SnapshotPoint[] }) {
  const chartData = snapshots.map((s) => ({
    month: fmtSnapshotDate(s.date),
    score: s.score,
    label: s.scoreLabel,
    overdueTotal: s.overdueTotal,
  }));

  return (
    <section>
      <div className="flex items-end justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-900">Evolución del score</h2>
        {snapshots.length > 0 && (
          <span className="text-xs text-gray-400">{snapshots.length} mes{snapshots.length !== 1 ? "es" : ""} registrado{snapshots.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {snapshots.length < 2 ? (
        <div className="card p-6 text-center border border-dashed border-gray-200">
          <p className="text-gray-400 text-sm">
            {snapshots.length === 0
              ? "El historial se registra automáticamente al cargar el plan. Vuelve el próximo mes para ver la evolución."
              : "Se necesitan al menos 2 meses de datos. Vuelve el próximo mes para ver la gráfica de evolución."}
          </p>
        </div>
      ) : (
        <div className="card p-6">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <ReferenceArea y1={80} y2={100} fill="#10b981" fillOpacity={0.07} />
              <ReferenceArea y1={65} y2={80}  fill="#3b82f6" fillOpacity={0.07} />
              <ReferenceArea y1={45} y2={65}  fill="#eab308" fillOpacity={0.06} />
              <ReferenceArea y1={25} y2={45}  fill="#f97316" fillOpacity={0.06} />
              <ReferenceArea y1={0}  y2={25}  fill="#ef4444" fillOpacity={0.06} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fontWeight: 600 }} />
              <YAxis domain={[0, 100]} tickCount={6} tick={{ fontSize: 11 }} width={32} />
              <Tooltip
                formatter={((v: unknown, _: unknown, item: { payload?: { label?: string } }) => [
                  v !== null && v !== undefined ? `${v}/100 — ${item.payload?.label ?? ""}` : "Sin datos",
                  "Score",
                ]) as any}
                contentStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                connectNulls={false}
                dot={<ScoreDot />}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 justify-center">
            {[
              { color: "#10b981", label: "Excelente ≥80" },
              { color: "#3b82f6", label: "Bueno ≥65" },
              { color: "#eab308", label: "Regular ≥45" },
              { color: "#f97316", label: "Ajustado ≥25" },
              { color: "#ef4444", label: "Crítico <25" },
            ].map((r) => (
              <span key={r.label} className="flex items-center gap-1 text-[11px] text-gray-500">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: r.color }} />
                {r.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-6 h-28 bg-gray-100" />
        ))}
      </div>
      <div className="card p-6 h-64 bg-gray-100" />
      <div className="card p-6 h-48 bg-gray-100" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-gray-600 text-sm max-w-md mx-auto">
        No hay información suficiente para generar un plan confiable. Registra ingresos, pagos pendientes o estados de cuenta para mejorar el análisis.
      </p>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  item: PaymentPlanItem;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmModal({ item, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Marcar como pagado</h3>
            <p className="text-sm text-gray-500 mt-1">
              ¿Confirmas que ya realizaste este pago?
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Pago</span>
            <span className="font-medium text-gray-900 text-right max-w-[220px] truncate">{item.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Monto</span>
            <span className="font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
          </div>
          {item.dueDate && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fecha límite</span>
              <span className="text-gray-700">{formatDate(item.dueDate)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Fecha de pago</span>
            <span className="text-gray-700">{formatDate(new Date().toISOString())}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Procesando…
              </>
            ) : (
              "Confirmar pago"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const MONTHS_OPTIONS = [
  { value: 1, label: "1 mes" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
];

export default function RecoveryPlanPage() {
  const [data, setData] = useState<RecoveryPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(3);

  // Sort state
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Mark-paid state
  const [confirmItem, setConfirmItem] = useState<PaymentPlanItem | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [successId, setSuccessId] = useState<string | null>(null);

  const fetchPlan = useCallback((m: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/financial/recovery-plan?months=${m}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Error del servidor");
        return json as RecoveryPlan;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e: Error) => {
        console.error("[recovery-plan page]", e.message);
        setError("No se pudo cargar el plan. Intenta de nuevo.");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchPlan(months);
  }, [months, fetchPlan]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  async function handleMarkPaid() {
    if (!confirmItem) return;
    setMarkingPaid(true);
    try {
      const res = await fetch(`/api/personal/payments/${confirmItem.id}/mark-paid`, {
        method: "PATCH",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Error al marcar el pago");
      setSuccessId(confirmItem.id);
      setConfirmItem(null);
      fetchPlan(months);
    } catch (e: unknown) {
      console.error("[mark-paid]", e);
      setError(e instanceof Error ? e.message : "Error al marcar el pago");
      setConfirmItem(null);
    } finally {
      setMarkingPaid(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header
          title="Plan para ponerme al corriente"
          subtitle="Prioriza tus pagos, entiende tu capacidad real y toma acción sin comprometer tu estabilidad."
        />
        <Skeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Header
          title="Plan para ponerme al corriente"
          subtitle="Prioriza tus pagos, entiende tu capacidad real y toma acción sin comprometer tu estabilidad."
        />
        <div className="card p-8 text-center">
          <p className="text-red-600 text-sm">{error ?? "No se pudieron cargar los datos."}</p>
          <button
            onClick={() => fetchPlan(months)}
            className="mt-4 text-sm text-indigo-600 hover:underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const { summary, paymentPlan, cutSuggestions, insights, dataQuality } = data;
  const hasUsableData =
    dataQuality.hasIncomeData ||
    dataQuality.hasExpenseData ||
    dataQuality.hasPendingPayments ||
    dataQuality.hasOverduePayments;

  const statusConf = STATUS_CONFIG[summary.financialStatus];

  const sortedPlan = sortPlan(paymentPlan, sortField, sortDir);

  const overviewChartData = [
    { name: "Ingreso",  value: summary.monthlyIncomeAvg  ?? 0, fill: "#06b6d4" },
    { name: "Egreso",   value: summary.monthlyExpenseAvg ?? 0, fill: "#f97316" },
  ];

  const debtChartData = [
    { name: "Vencido",     value: summary.overdueTotal,    fill: "#ef4444" },
    { name: "Pendiente",   value: summary.pendingTotal,    fill: "#f59e0b" },
    { name: "Próx. 7 días", value: summary.dueIn7DaysTotal, fill: "#8b5cf6" },
  ];

  return (
    <>
      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          onConfirm={handleMarkPaid}
          onCancel={() => setConfirmItem(null)}
          loading={markingPaid}
        />
      )}

      <div className="space-y-8">
        {/* ── Header + controles ───────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <Header
            title="Plan para ponerme al corriente"
            subtitle="Prioriza tus pagos, entiende tu capacidad real y toma acción sin comprometer tu estabilidad."
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500 whitespace-nowrap">Analizar últimos:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {MONTHS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMonths(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    months === opt.value
                      ? "bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sin datos suficientes ──────────────────────────────── */}
        {!hasUsableData && <EmptyState />}

        {hasUsableData && (
          <>
            {/* ── Score financiero ─────────────────────────────── */}
            <ScoreWidget score={data.financialScore} statusConf={statusConf} />

            {/* ── Evolución del score ───────────────────────────── */}
            <ScoreHistoryChart snapshots={data.snapshots} />

            {/* ── KPI Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard
                title="Ingreso mensual prom."
                value={fmtNull(summary.monthlyIncomeAvg)}
                subtitle={`Últimos ${months} meses`}
                iconBg="bg-cyan-100"
                icon={<svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 7l3-3M7 7l3 3" /></svg>}
              />
              <StatCard
                title="Egreso mensual prom."
                value={fmtNull(summary.monthlyExpenseAvg)}
                subtitle={`Últimos ${months} meses`}
                iconBg="bg-orange-100"
                icon={<svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17H7m10 0l-3-3m3 3l-3 3" /></svg>}
              />
              <StatCard
                title="Total vencido"
                value={formatCurrency(summary.overdueTotal)}
                subtitle="Requiere acción inmediata"
                iconBg={summary.overdueTotal > 0 ? "bg-red-100" : "bg-gray-100"}
                icon={<svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
              />
              <StatCard
                title="Total pendiente"
                value={formatCurrency(summary.pendingTotal)}
                subtitle="Por liquidar"
                iconBg="bg-yellow-100"
                icon={<svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              />
              <StatCard
                title="Flujo libre est."
                value={fmtNull(summary.freeCashflow)}
                subtitle="Ingreso − Egreso"
                iconBg={summary.freeCashflow !== null && summary.freeCashflow < 0 ? "bg-red-100" : "bg-emerald-100"}
                icon={<svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
              />
              <StatCard
                title="Capacidad de pago"
                value={fmtNull(summary.availableForDebt)}
                subtitle="Flujo libre − reserva"
                iconBg="bg-indigo-100"
                icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
              />
            </div>

            {/* ── Gráficas ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Ingreso vs Egreso mensual</h2>
                <p className="text-xs text-gray-400 mb-4">Promedio de los últimos {months} meses</p>
                {summary.monthlyIncomeAvg === null && summary.monthlyExpenseAvg === null ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sin datos suficientes</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={overviewChartData} barSize={56}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 13, fontWeight: 600 }} />
                      <YAxis tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={((v: number) => [formatCurrency(Number(v)), ""]) as any} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {overviewChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-1">Deuda pendiente por urgencia</h2>
                <p className="text-xs text-gray-400 mb-4">Totales actuales</p>
                {summary.overdueTotal === 0 && summary.pendingTotal === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sin pagos pendientes o vencidos</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={debtChartData} barSize={44}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600 }} />
                      <YAxis tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={((v: number) => [formatCurrency(Number(v)), ""]) as any} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {debtChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ── Proyección ───────────────────────────────────── */}
            <ForecastSection forecast={data.forecast} />

            {/* ── Insights ──────────────────────────────────────── */}
            {insights.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Análisis y alertas</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.map((insight, i) => {
                    const conf = INSIGHT_CONFIG[insight.type];
                    return (
                      <div key={i} className={`card p-5 border ${conf.border} ${conf.bg}`}>
                        <div className="flex items-start gap-3">
                          <span className={`flex-shrink-0 w-7 h-7 rounded-full bg-white flex items-center justify-center text-sm font-bold ${conf.iconColor} shadow-sm`}>
                            {conf.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${conf.iconColor} mb-0.5`}>{insight.title}</p>
                            <p className="text-sm text-gray-700">{insight.message}</p>
                            <p className="text-xs text-gray-500 mt-2 italic">→ {insight.suggestedAction}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Qué pagar primero ─────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-gray-900">Qué pagar primero</h2>
                {successId && (
                  <span className="text-xs text-emerald-600 font-medium animate-pulse">
                    ✓ Pago marcado como pagado
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Ordenado por urgencia y monto. Los vencidos siempre van primero. Haz clic en el encabezado para ordenar.
              </p>

              {paymentPlan.length === 0 ? (
                <div className="card p-8 text-center">
                  <p className="text-gray-400 text-sm">No hay pagos pendientes ni vencidos registrados.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <SortHeader label="Prioridad"    field="priority" current={sortField} dir={sortDir} onSort={handleSort} />
                          <th className="px-4 py-3">Pago / Deuda</th>
                          <th className="px-4 py-3">Categoría</th>
                          <SortHeader label="Monto"        field="amount"   current={sortField} dir={sortDir} onSort={handleSort} />
                          <SortHeader label="Fecha límite" field="dueDate"  current={sortField} dir={sortDir} onSort={handleSort} />
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Acción</th>
                          <th className="px-4 py-3">Razón</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {sortedPlan.map((item: PaymentPlanItem) => {
                          const isOverdue = item.status === "OVERDUE";
                          const rowBg = isOverdue ? "bg-red-50/50" : "";
                          return (
                            <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${rowBg}`}>
                              <td className="px-4 py-3">{getPriorityBadge(item.priority)}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900 max-w-[180px] truncate" title={item.name}>
                                  {item.name}
                                </p>
                                {item.paymentMethod && (
                                  <p className="text-xs text-gray-400 mt-0.5">{item.paymentMethod}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                  {item.category ?? "Sin categoría"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                                {formatCurrency(item.amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                                {item.dueDate ? formatDate(item.dueDate) : "—"}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={item.status} />
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium px-2 py-1 rounded-md whitespace-nowrap ${
                                  item.recommendedAction === "Pagar de inmediato"
                                    ? "bg-red-100 text-red-700"
                                    : item.recommendedAction === "Pagar esta semana"
                                      ? "bg-amber-100 text-amber-700"
                                      : item.recommendedAction === "Programar pago"
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-100 text-gray-600"
                                }`}>
                                  {item.recommendedAction}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">
                                {item.reason}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => { setSuccessId(null); setConfirmItem(item); }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors whitespace-nowrap"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Marcar pagado
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* ── Qué recortar ──────────────────────────────────── */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Qué recortar este mes</h2>
              <p className="text-sm text-gray-500 mb-4">Gastos variables con mayor potencial de reducción basado en tu historial.</p>

              {cutSuggestions.length === 0 ? (
                <div className="card p-6 text-center">
                  <p className="text-gray-400 text-sm">
                    {dataQuality.hasExpenseData
                      ? "No se detectaron gastos variables con margen de reducción."
                      : "Sin historial de gastos para analizar sugerencias de recorte."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cutSuggestions.map((c: CutSuggestion, i) => (
                    <div key={i} className="card p-5 border border-emerald-100">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className="text-sm font-semibold text-gray-800">{c.category}</span>
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                          Reducible
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Gasto mensual</span>
                          <span className="font-medium text-gray-900">{formatCurrency(c.monthlyAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Reducción sugerida</span>
                          <span className="font-semibold text-emerald-700">−{formatCurrency(c.suggestedReduction)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">{c.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Data quality notice ───────────────────────────── */}
            {dataQuality.missingFields.length > 0 && (
              <div className="card p-4 border border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400">
                  El análisis de categorías usa inferencia por nombre. Para mayor precisión, clasifica tus ingresos en categorías como &ldquo;Sueldo&rdquo;, &ldquo;Depósito&rdquo; o &ldquo;Ingreso&rdquo;.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
