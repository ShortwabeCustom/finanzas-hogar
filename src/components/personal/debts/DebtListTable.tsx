"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import DebtProgress from "./DebtProgress";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateDebtProgress } from "@/lib/financial/debt-calculations";
import {
  DEBT_TYPE_LABELS,
  DEBT_STATUS_LABELS,
  DEBT_STATUS_COLORS,
} from "@/lib/financial/debt-labels";

interface DebtAccount {
  id: string;
  name: string;
  counterpartyName: string | null;
  type: string;
  direction: "PAYABLE" | "RECEIVABLE";
  originalPrincipal: number;
  currentPrincipal: number;
  status: string;
  nextDueDate: string | null;
  startDate: string;
  personalCardId: string | null;
  scheduleMode: "FREE" | "INSTALLMENTS";
}

interface DebtListTableProps {
  debts: DebtAccount[];
}

export default function DebtListTable({ debts }: DebtListTableProps) {
  const router = useRouter();

  if (debts.length === 0) {
    return null;
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nombre</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Contraparte</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tipo</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Monto Original</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Saldo Pendiente</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Próximo Pago</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Progreso</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
            <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((debt) => {
            const progress = calculateDebtProgress(debt.originalPrincipal, debt.originalPrincipal - debt.currentPrincipal);
            const isHighBalance = debt.currentPrincipal > debt.originalPrincipal * 0.7;

            return (
              <tr key={debt.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 text-sm">
                  <Link href={`/personal/debts/${debt.id}`} className="font-medium text-indigo-600 hover:text-indigo-700">
                    {debt.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{debt.counterpartyName || "—"}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                    {DEBT_TYPE_LABELS[debt.type] || debt.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(debt.originalPrincipal)}</td>
                <td className={cn("px-6 py-4 text-sm text-right font-medium", isHighBalance && "text-red-600")}>
                  {formatCurrency(debt.currentPrincipal)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {debt.nextDueDate ? formatDate(debt.nextDueDate) : "—"}
                </td>
                <td className="px-6 py-4 text-sm">
                  <DebtProgress progress={progress.progress} size="sm" showLabel={false} />
                </td>
                <td className="px-6 py-4 text-sm">
                  <StatusBadge
                    status={debt.status}
                    labels={DEBT_STATUS_LABELS}
                    styles={DEBT_STATUS_COLORS}
                  />
                </td>
                <td className="px-6 py-4 text-sm text-center">
                  <button
                    onClick={() => router.push(`/personal/debts/${debt.id}`)}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Ver →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
