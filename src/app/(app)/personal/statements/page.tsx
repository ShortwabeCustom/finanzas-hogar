"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";

interface BankAccount {
  id: string;
  bankName: string;
  productName: string;
  cardNumber: string | null;
  type: string;
  currency: string;
}

interface BankStatement {
  id: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number | null;
  closingBalance: number | null;
  totalCharges: number | null;
  totalCredits: number | null;
  sourceFile: string | null;
  account: BankAccount;
}

interface BankTransaction {
  id: string;
  transactionDate: string;
  description: string;
  reference: string | null;
  chargeAmount: number | null;
  creditAmount: number | null;
  balance: number | null;
  category: string | null;
}

function periodLabel(start: string): string {
  const d = new Date(start + "T12:00:00");
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

export default function StatementsPage() {
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<BankStatement | null>(null);
  const [loadingStatements, setLoadingStatements] = useState(true);
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "charge" | "credit">("");

  useEffect(() => {
    fetch("/api/financial/statements")
      .then((r) => r.json())
      .then((d) => {
        const sorted = (Array.isArray(d) ? d : []).sort(
          (a: BankStatement, b: BankStatement) =>
            new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime()
        );
        setStatements(sorted);
        if (sorted.length > 0) setSelectedStatement(sorted[0]);
      })
      .finally(() => setLoadingStatements(false));
  }, []);

  const fetchTransactions = useCallback(() => {
    if (!selectedStatement) return;
    setLoadingTxns(true);
    const params = new URLSearchParams({ accountId: selectedStatement.accountId });
    params.set("date_from", selectedStatement.periodStart.slice(0, 10));
    params.set("date_to", selectedStatement.periodEnd.slice(0, 10));
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    fetch(`/api/financial/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => setTransactions(Array.isArray(d) ? d : []))
      .finally(() => setLoadingTxns(false));
  }, [selectedStatement, typeFilter, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalCharges = transactions.reduce((s, t) => s + Number(t.chargeAmount ?? 0), 0);
  const totalCredits = transactions.reduce((s, t) => s + Number(t.creditAmount ?? 0), 0);

  return (
    <div className="space-y-6">
      <Header
        title="Estados de Cuenta"
        subtitle="Movimientos bancarios importados de Santander Free Oro"
      />

      {loadingStatements ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      ) : statements.length === 0 ? (
        <div className="card text-center py-16">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 font-medium">Sin estados de cuenta</p>
          <p className="text-gray-400 text-sm mt-1">Importa estados de cuenta para verlos aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* ── Panel izquierdo: lista de períodos ── */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
              Períodos ({statements.length})
            </p>
            {statements.map((s) => {
              const isSelected = selectedStatement?.id === s.id;
              const charges = Number(s.totalCharges ?? 0);
              const credits = Number(s.totalCredits ?? 0);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStatement(s);
                    setSearch("");
                    setTypeFilter("");
                  }}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
                  }`}
                >
                  <p className={`text-sm font-semibold capitalize ${isSelected ? "text-indigo-700" : "text-gray-800"}`}>
                    {periodLabel(s.periodStart)}
                  </p>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-red-600">↑ {formatCurrency(charges)}</span>
                    <span className="text-green-600">↓ {formatCurrency(credits)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Panel derecho: transacciones ── */}
          <div className="lg:col-span-3 space-y-4">

            {/* Resumen del período seleccionado */}
            {selectedStatement && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Período",
                    value: periodLabel(selectedStatement.periodStart),
                    sub: `${formatDate(selectedStatement.periodStart)} — ${formatDate(selectedStatement.periodEnd)}`,
                    color: "bg-indigo-50 text-indigo-700",
                  },
                  {
                    label: "Transacciones",
                    value: transactions.length,
                    sub: "en este período",
                    color: "bg-gray-50 text-gray-700",
                  },
                  {
                    label: "Total cargos",
                    value: formatCurrency(totalCharges),
                    sub: "egresos del período",
                    color: "bg-red-50 text-red-700",
                  },
                  {
                    label: "Total abonos",
                    value: formatCurrency(totalCredits),
                    sub: "ingresos del período",
                    color: "bg-green-50 text-green-700",
                  },
                ].map((kpi) => (
                  <div key={kpi.label} className={`rounded-xl p-4 ${kpi.color}`}>
                    <p className="text-xs font-medium opacity-70">{kpi.label}</p>
                    <p className="text-lg font-bold mt-1 leading-tight">{kpi.value}</p>
                    <p className="text-xs opacity-60 mt-0.5">{kpi.sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Filtros */}
            <div className="card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  className="input"
                  placeholder="Buscar descripción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="input"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                >
                  <option value="">Todos los movimientos</option>
                  <option value="charge">Solo cargos</option>
                  <option value="credit">Solo abonos</option>
                </select>
                <div className="flex items-center gap-1 text-xs text-gray-400 pl-1">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>{selectedStatement?.account.bankName} {selectedStatement?.account.productName} •••• {selectedStatement?.account.cardNumber ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Tabla de transacciones */}
            <div className="card overflow-hidden">
              {loadingTxns ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">Sin movimientos{search || typeFilter ? " con estos filtros" : ""}</p>
                </div>
              ) : (
                <>
                  {/* Mobile */}
                  <div className="sm:hidden divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <div key={t.id} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 leading-snug">{t.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.transactionDate)}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {t.chargeAmount != null && Number(t.chargeAmount) !== 0 && (
                              <p className="text-sm font-semibold text-red-600">−{formatCurrency(t.chargeAmount)}</p>
                            )}
                            {t.creditAmount != null && Number(t.creditAmount) !== 0 && (
                              <p className="text-sm font-semibold text-green-600">+{formatCurrency(t.creditAmount)}</p>
                            )}
                            {t.balance != null && (
                              <p className="text-xs text-gray-400 mt-0.5">Saldo {formatCurrency(t.balance)}</p>
                            )}
                          </div>
                        </div>
                        {t.reference && (
                          <p className="text-xs text-indigo-500 mt-1 font-mono">{t.reference}</p>
                        )}
                      </div>
                    ))}
                    <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center text-sm font-semibold">
                      <span className="text-gray-600">{transactions.length} movimientos</span>
                      <div className="flex gap-4">
                        <span className="text-red-600">−{formatCurrency(totalCharges)}</span>
                        <span className="text-green-600">+{formatCurrency(totalCredits)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Descripción</th>
                          <th className="px-4 py-3">Referencia</th>
                          <th className="px-4 py-3 text-right">Cargo</th>
                          <th className="px-4 py-3 text-right">Abono</th>
                          <th className="px-4 py-3 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.map((t) => (
                          <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(t.transactionDate)}</td>
                            <td className="px-4 py-3 text-gray-900 max-w-xs">
                              <p className="truncate font-medium">{t.description}</p>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-indigo-500 whitespace-nowrap">{t.reference ?? "—"}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-red-600">
                              {t.chargeAmount != null && Number(t.chargeAmount) !== 0
                                ? formatCurrency(t.chargeAmount)
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-green-600">
                              {t.creditAmount != null && Number(t.creditAmount) !== 0
                                ? formatCurrency(t.creditAmount)
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap text-gray-500">
                              {t.balance != null ? formatCurrency(t.balance) : <span className="text-gray-300">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-600">
                            {transactions.length} movimiento{transactions.length !== 1 ? "s" : ""}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totalCharges)}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(totalCredits)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
