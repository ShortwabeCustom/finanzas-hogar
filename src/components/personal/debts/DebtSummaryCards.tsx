import StatCard from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/utils";

interface DebtSummary {
  totalPayable: number;
  totalReceivable: number;
  estimatedMonthlyPayment: number;
  nextDueDate: string | null;
  overdueInstallments: number;
  principalPaidCurrentYear: number;
}

interface DebtSummaryCardsProps {
  summary: DebtSummary;
  onTabSelect?: (tab: "payable" | "receivable" | "paid-off") => void;
}

export default function DebtSummaryCards({ summary, onTabSelect }: DebtSummaryCardsProps) {
  const handlePayableClick = () => {
    onTabSelect?.("payable");
  };

  const handleReceivableClick = () => {
    onTabSelect?.("receivable");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <button
        onClick={handlePayableClick}
        className="text-left transition-transform hover:scale-105"
      >
        <StatCard
          title="Saldo por pagar"
          value={formatCurrency(summary.totalPayable)}
          icon={
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          }
          iconBg="bg-indigo-100"
        />
      </button>

      <button
        onClick={handleReceivableClick}
        className="text-left transition-transform hover:scale-105"
      >
        <StatCard
          title="Saldo por cobrar"
          value={formatCurrency(summary.totalReceivable)}
          icon={
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          iconBg="bg-green-100"
        />
      </button>

      <StatCard
        title="Pago mensual estimado"
        value={formatCurrency(summary.estimatedMonthlyPayment)}
        icon={
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12M8 11h12m-12 4h12M3 7l1.5 1.5M3 11l1.5 1.5M3 15l1.5 1.5"
            />
          </svg>
        }
        iconBg="bg-blue-100"
      />

      <StatCard
        title="Próximo vencimiento"
        value={summary.nextDueDate ? new Date(summary.nextDueDate).toLocaleDateString("es-MX", { month: "short", day: "numeric" }) : "—"}
        icon={
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        }
        iconBg={summary.overdueInstallments > 0 ? "bg-amber-100" : "bg-gray-100"}
      />

      <StatCard
        title="Cuotas vencidas"
        value={summary.overdueInstallments.toString()}
        icon={
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4v2m0 4v2M6.5 6.5h11a2 2 0 012 2v11a2 2 0 01-2 2h-11a2 2 0 01-2-2v-11a2 2 0 012-2z"
            />
          </svg>
        }
        iconBg={summary.overdueInstallments > 0 ? "bg-red-100" : "bg-gray-100"}
      />

      <StatCard
        title="Capital liquidado (año actual)"
        value={formatCurrency(summary.principalPaidCurrentYear)}
        icon={
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        }
        iconBg="bg-emerald-100"
      />
    </div>
  );
}
