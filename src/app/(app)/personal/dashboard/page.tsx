"use client";

import { useEffect, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip,
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

export default function PersonalDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personal/dashboard")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? "Error del servidor");
        return d;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { console.error("[personal/dashboard]", e); setLoading(false); });
  }, []);

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
    paidThisMonth = 0,
    byCategory = [],
    byMethod = [],
    upcoming = [],
    recent = [],
  } = data ?? {};

  const methodData = byMethod.map((m: any) => ({
    name: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
    value: m.total,
    color: METHOD_COLORS[m.method] ?? "#94a3b8",
  }));

  return (
    <div className="space-y-6">
      <Header
        title="Mi Dashboard"
        subtitle="Resumen exclusivo de tus finanzas personales"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total pagos"
          value={totalCount}
          subtitle="Registros personales"
          iconBg="bg-indigo-100"
          icon={<svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
        />
        <StatCard
          title="Pagado este mes"
          value={formatCurrency(paidThisMonth)}
          subtitle="Pagos confirmados"
          iconBg="bg-green-100"
          icon={<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Mis gastos por categoría</h2>
          {byCategory.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Sin datos aún</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="total"
                  nameKey="name"
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {byCategory.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={((v: number) => formatCurrency(v)) as any} />
              </PieChart>
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
          <h2 className="text-base font-semibold text-gray-900 mb-4">Próximos vencimientos (7 días)</h2>
          {upcoming.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No hay vencimientos próximos</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.category?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-amber-700">Vence: {formatDate(p.dueDate)}</p>
                  </div>
                </div>
              ))}
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
