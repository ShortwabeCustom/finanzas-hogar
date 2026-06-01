"use client";

import { useEffect, useState } from "react";
import {
  Treemap, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from "recharts";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from "@/lib/utils";

const METHOD_COLORS: Record<string, string> = {
  CASH: "#22c55e",
  CREDIT_CARD: "#6366f1",
  DEBIT_CARD: "#3b82f6",
  TRANSFER: "#f59e0b",
  CHECK: "#8b5cf6",
  OTHER: "#94a3b8",
};

const TREEMAP_PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#e11d48", "#4f46e5",
  "#0f766e", "#a16207", "#c026d3", "#0284c7", "#65a30d", "#9333ea", "#ea580c", "#0ea5e9",
  "#be123c", "#059669", "#1d4ed8", "#b91c1c",
];

function getTreemapColorByIndex(index: number): string {
  if (index < TREEMAP_PALETTE.length) return TREEMAP_PALETTE[index];
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 72%, 48%)`;
}

function getTreemapColorByName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const index = Math.abs(hash) % TREEMAP_PALETTE.length;
  return TREEMAP_PALETTE[index];
}

function TreemapCategoryContent(props: any) {
  const { x, y, width, height, name, payload } = props;
  const label = String(name ?? payload?.name ?? "");
  const fill = payload?.fill ?? payload?.color ?? getTreemapColorByName(label);
  if (width <= 0 || height <= 0) return null;
  const showLabel = width > 90 && height > 34;

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#ffffff" strokeWidth={2} />
      {showLabel && (
        <text x={x + 8} y={y + 20} fill="#ffffff" fontSize={12} fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  );
}

export default function PersonalDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"day" | "week" | "month" | "year" | "range">("year");
  const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10));
  const [selectedWeek, setSelectedWeek] = useState(`${new Date().getFullYear()}-W01`);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));

  function buildRange(): { from: string; to: string; label: string } {
    if (timeFilter === "day") return { from: selectedDay, to: selectedDay, label: "del día seleccionado" };
    if (timeFilter === "week") {
      const m = selectedWeek.match(/^(\d{4})-W(\d{2})$/);
      if (!m) return { from: selectedDay, to: selectedDay, label: "de la semana seleccionada" };
      const year = Number(m[1]);
      const week = Number(m[2]);
      const jan4 = new Date(year, 0, 4);
      const jan4Day = jan4.getDay() || 7;
      const mondayWeek1 = new Date(jan4);
      mondayWeek1.setDate(jan4.getDate() - (jan4Day - 1));
      const start = new Date(mondayWeek1);
      start.setDate(mondayWeek1.getDate() + (week - 1) * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: "de la semana seleccionada",
      };
    }
    if (timeFilter === "month") {
      const [y, m] = selectedMonth.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
        label: "del mes seleccionado",
      };
    }
    if (timeFilter === "year") {
      return {
        from: `${selectedYear}-01-01`,
        to: `${selectedYear}-12-31`,
        label: `del año ${selectedYear}`,
      };
    }
    return { from: fromDate, to: toDate, label: "del rango seleccionado" };
  }

  useEffect(() => {
    const range = buildRange();
    setLoading(true);
    const granularity = timeFilter === "week" ? "day" : timeFilter === "month" ? "week" : "month";
    fetch(`/api/personal/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&granularity=${granularity}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? "Error del servidor");
        return d;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { console.error("[personal/dashboard]", e); setLoading(false); });
  }, [timeFilter, selectedDay, selectedWeek, selectedMonth, selectedYear, fromDate, toDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  const {
    totalCount = 0,
    pendingCount = 0,
    overdueCount = 0,
    overdueTotal = 0,
    pendingTotal = 0,
    monthlyIncomeAvg = null,
    paidInRange = 0,
    receivedInRange = 0,
    savingsInRange = 0,
    byCategory = [],
    byMethod = [],
    monthlyFlow = [],
    upcoming = [],
    recent = [],
  } = data ?? {};
  const deudaTotal = overdueTotal + pendingTotal;
  const rangeMeta = buildRange();

  const methodData = byMethod.map((m: any) => ({
    name: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
    value: m.total,
    color: METHOD_COLORS[m.method] ?? "#94a3b8",
  }));
  const categoryTreemapData = byCategory.map((item: any, index: number) => ({
    name: item.name,
    value: Number(item.total ?? 0),
    fill: getTreemapColorByIndex(index),
  }));

  return (
    <div className="space-y-6">
      <Header
        title="Mi Dashboard"
        subtitle="Resumen exclusivo de tus finanzas personales"
      />

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">Tiempo</label>
            <select className="input w-44" value={timeFilter} onChange={(e) => setTimeFilter(e.target.value as any)}>
              <option value="day">Por día</option>
              <option value="week">Por semana</option>
              <option value="month">Por mes</option>
              <option value="year">Por año</option>
              <option value="range">Rango de fechas</option>
            </select>
          </div>
          {timeFilter === "day" && (
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input w-44" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
            </div>
          )}
          {timeFilter === "month" && (
            <div>
              <label className="label">Mes</label>
              <input type="month" className="input w-44" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
            </div>
          )}
          {timeFilter === "week" && (
            <div>
              <label className="label">Semana</label>
              <input type="week" className="input w-44" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} />
            </div>
          )}
          {timeFilter === "year" && (
            <div>
              <label className="label">Año</label>
              <input type="number" className="input w-32" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value) || new Date().getFullYear())} min={2020} max={2100} />
            </div>
          )}
          {timeFilter === "range" && (
            <>
              <div>
                <label className="label">Desde</label>
                <input type="date" className="input w-44" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input type="date" className="input w-44" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total pagos"
          value={totalCount}
          subtitle="Registros personales"
          iconBg="bg-indigo-100"
          icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <StatCard
          title="Pagado en periodo"
          value={formatCurrency(paidInRange)}
          subtitle={`Pagos confirmados ${rangeMeta.label}`}
          iconBg="bg-green-100"
          icon={<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Fondos disponibles"
          value={formatCurrency(savingsInRange)}
          subtitle={`Ahorros acumulados ${rangeMeta.label}`}
          iconBg="bg-emerald-100"
          icon={<svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
        />
        <StatCard
          title="Dinero recibido"
          value={formatCurrency(receivedInRange)}
          subtitle="Depósitos + transferencias recibidas"
          iconBg="bg-cyan-100"
          icon={<svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 7l3-3M7 7l3 3M17 17H7m10 0l-3-3m3 3l-3 3" /></svg>}
        />
        <StatCard
          title="Pendientes"
          value={pendingCount}
          subtitle="Por liquidar"
          iconBg="bg-yellow-100"
          icon={<svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard
          title="Vencidos"
          value={overdueCount}
          subtitle="Requieren atención"
          iconBg="bg-red-100"
          icon={<svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
        />
      </div>

      {/* Deuda e Ingresos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`card p-5 border-l-4 ${overdueTotal > 0 ? "border-l-red-500" : deudaTotal > 0 ? "border-l-amber-400" : "border-l-green-400"}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Deuda Total</p>
              <p className={`text-2xl font-bold ${overdueTotal > 0 ? "text-red-600" : deudaTotal > 0 ? "text-amber-600" : "text-green-600"}`}>
                {formatCurrency(deudaTotal)}
              </p>
              <div className="flex gap-4 mt-2">
                <span className="text-xs text-red-500 font-medium">Vencida: {formatCurrency(overdueTotal)}</span>
                <span className="text-xs text-amber-500 font-medium">Pendiente: {formatCurrency(pendingTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Snapshot actual · todos los pagos activos</p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-4 ${overdueTotal > 0 ? "bg-red-100" : deudaTotal > 0 ? "bg-amber-100" : "bg-green-100"}`}>
              <svg className={`w-5 h-5 ${overdueTotal > 0 ? "text-red-600" : deudaTotal > 0 ? "text-amber-600" : "text-green-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card p-5 border-l-4 border-l-indigo-400">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Ingreso Promedio Mensual</p>
              <p className="text-2xl font-bold text-indigo-600">
                {monthlyIncomeAvg !== null ? formatCurrency(monthlyIncomeAvg) : "Sin datos"}
              </p>
              {monthlyIncomeAvg !== null && deudaTotal > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  La deuda representa el <span className="font-semibold text-gray-700">{((deudaTotal / monthlyIncomeAvg) * 100).toFixed(0)}%</span> de un ingreso mensual
                </p>
              )}
              {monthlyIncomeAvg === null && (
                <p className="text-xs text-gray-400 mt-2">Registra ingresos en categorías como Sueldo, Depósito o Ingreso</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Promedio de los últimos 3 meses</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ml-4 bg-indigo-100">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          {timeFilter === "week" ? "Flujo diario: gastado vs recibido" : timeFilter === "month" ? "Flujo semanal: gastado vs recibido" : "Flujo mensual: gastado vs recibido"}
        </h2>
        {monthlyFlow.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyFlow}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
              <Tooltip formatter={((v: number) => formatCurrency(Number(v))) as any} />
              <Bar dataKey="spent" name="Gastado" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" name="Recibido" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Mis gastos por categoría</h2>
          {categoryTreemapData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={categoryTreemapData}
                dataKey="value"
                nameKey="name"
                aspectRatio={4 / 3}
                content={<TreemapCategoryContent />}
              >
                <Tooltip
                  formatter={((v: number) => formatCurrency(Number(v))) as any}
                  labelFormatter={(_, payload: any) => payload?.[0]?.payload?.name ?? ""}
                />
              </Treemap>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Mis gastos por forma de pago</h2>
          {methodData.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={methodData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={((v: number) => formatCurrency(v)) as any} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {methodData.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Upcoming + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Próximos vencimientos (15 días)</h2>
          {upcoming.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No hay vencimientos próximos en los siguientes 15 días</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((p: any) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(p.dueDate);
                due.setHours(0, 0, 0, 0);
                const daysLeft = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                const urgency = daysLeft <= 2 ? "red" : daysLeft <= 5 ? "amber" : "green";
                const colors = {
                  red: { bg: "bg-red-50", border: "border-red-100", dot: "bg-red-400", badge: "bg-red-100 text-red-700", date: "text-red-700" },
                  amber: { bg: "bg-amber-50", border: "border-amber-100", dot: "bg-amber-400", badge: "bg-amber-100 text-amber-700", date: "text-amber-700" },
                  green: { bg: "bg-green-50", border: "border-green-100", dot: "bg-green-400", badge: "bg-green-100 text-green-700", date: "text-green-700" },
                }[urgency];
                return (
                  <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${colors.bg} border ${colors.border}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-500">{p.category?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(p.amount)}</p>
                      <p className={`text-xs ${colors.date}`}>Vence: {formatDate(p.dueDate)}</p>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.badge}`}>
                        {daysLeft === 0 ? "Hoy" : daysLeft === 1 ? "Mañana" : `${daysLeft} días`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Últimos pagos</h2>
          {recent.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Sin registros</p>
          ) : (
            <div className="space-y-3">
              {recent.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.category?.color }} />
                      <span className="text-xs text-gray-500 truncate">{p.category?.name}</span>
                    </div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments table */}
      {recent.length > 0 && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Últimos pagos registrados</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="pb-3">Folio</th>
                  <th className="pb-3">Nombre</th>
                  <th className="pb-3">Categoría</th>
                  <th className="pb-3">Monto</th>
                  <th className="pb-3">Estado</th>
                  <th className="pb-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recent.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-3 font-mono text-xs text-indigo-700">{p.folio}</td>
                    <td className="py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.category?.color }} />
                        <span className="text-gray-600">{p.category?.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="py-3"><StatusBadge status={p.status} /></td>
                    <td className="py-3 text-gray-500">{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
