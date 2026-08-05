'use client';

import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';

interface DebtsPendingSectionProps {
  debts: {
    totalPayable: number;
    totalReceivable: number;
    nextDueDate: string | null;
    overdueCount: number;
    mostUrgent: {
      id: string;
      name: string;
      type: string;
      currentPrincipal: number;
      originalPrincipal: number;
      nextDueDate: string;
    } | null;
    overdue: Array<{
      id: string;
      name: string;
      type: string;
      daysOverdue: number;
    }>;
  };
}

export default function DebtsPendingSection({ debts }: DebtsPendingSectionProps) {
  if (debts.totalPayable === 0 && debts.totalReceivable === 0) {
    // Empty state
    return (
      <section className="card p-8">
        <div className="text-center">
          <div className="text-4xl mb-3">💰</div>
          <p className="text-lg font-semibold text-gray-900 mb-2">
            Sin deudas ni préstamos registrados
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Empieza a controlar lo que debes o te deben.
          </p>
          <Link
            href="/personal/debts"
            className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Registrar primera deuda
          </Link>
        </div>
      </section>
    );
  }

  const progress = debts.mostUrgent
    ? Math.min(
        100,
        Math.round(
          ((debts.mostUrgent.originalPrincipal - debts.mostUrgent.currentPrincipal) /
            debts.mostUrgent.originalPrincipal) *
            100
        )
      )
    : 0;

  const daysUntilDue = debts.nextDueDate
    ? Math.ceil(
        (new Date(debts.nextDueDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Deudas Pendientes</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Saldo por Pagar</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(debts.totalPayable)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Próximo Vencimiento</p>
          <p className="text-2xl font-bold text-gray-900">
            {debts.nextDueDate ? (
              <>
                <span className="text-lg">{formatDate(debts.nextDueDate)}</span>
                <br />
                <span className="text-sm text-indigo-600">
                  {daysUntilDue !== null && daysUntilDue > 0 ? `${daysUntilDue} días` : daysUntilDue === 0 ? 'Hoy' : 'Vencida'}
                </span>
              </>
            ) : (
              'Sin vencimiento'
            )}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600 mb-1">Cuotas Vencidas</p>
          <p className="text-2xl font-bold">
            <span className={debts.overdueCount > 0 ? 'text-red-600' : 'text-gray-900'}>
              {debts.overdueCount}
            </span>
          </p>
          {debts.overdueCount > 0 && (
            <p className="text-xs text-red-600 mt-2">
              <Link href="/personal/debts?tab=overdue" className="underline hover:no-underline">
                Ver deudas vencidas →
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Most Urgent Card */}
      {debts.mostUrgent && (
        <Link href={`/personal/debts/${debts.mostUrgent.id}`} className="card p-6 hover:bg-indigo-50 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{debts.mostUrgent.name}</h3>
              <p className="text-sm text-gray-600 mt-1">Más urgente</p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">
              {debts.mostUrgent.type}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Saldo</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(debts.mostUrgent.currentPrincipal)} / {formatCurrency(debts.mostUrgent.originalPrincipal)}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-600 mt-1">{progress}% pagado</p>
          </div>

          {debts.mostUrgent.nextDueDate && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Próximo pago:</span> {formatDate(debts.mostUrgent.nextDueDate)}
            </p>
          )}

          <div className="mt-4">
            <span className="text-sm text-indigo-600 font-medium hover:underline">
              Ver deuda →
            </span>
          </div>
        </Link>
      )}

      {/* Overdue List */}
      {debts.overdue.length > 0 && (
        <div className="card p-6">
          <button className="flex items-center justify-between w-full mb-4">
            <h3 className="font-semibold text-gray-900">Vencidas ({debts.overdue.length})</h3>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          <div className="space-y-2">
            {debts.overdue.map((debt) => (
              <Link
                key={debt.id}
                href={`/personal/debts/${debt.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-red-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{debt.name}</p>
                  <p className="text-xs text-gray-600">{debt.type}</p>
                </div>
                <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded">
                  {debt.daysOverdue} días
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
