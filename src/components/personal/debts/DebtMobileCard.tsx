import DebtProgress from "./DebtProgress";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { calculateDebtProgress } from "@/lib/financial/debt-calculations";

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

interface DebtMobileCardProps {
  debt: DebtAccount;
  onClick?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activa",
  PAID_OFF: "Liquidada",
  PAUSED: "Pausada",
  CANCELLED: "Cancelada",
  DEFAULTED: "En mora",
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAID_OFF: "bg-emerald-100 text-emerald-800",
  PAUSED: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  DEFAULTED: "bg-red-100 text-red-800",
};

export default function DebtMobileCard({ debt, onClick }: DebtMobileCardProps) {
  const progress = calculateDebtProgress(debt.originalPrincipal, debt.originalPrincipal - debt.currentPrincipal);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{debt.name}</h3>
          {debt.counterpartyName && <p className="text-xs text-gray-500 truncate">{debt.counterpartyName}</p>}
        </div>
        <StatusBadge
          status={debt.status}
          labels={STATUS_LABELS}
          styles={STATUS_BADGE_STYLES}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Saldo</p>
          <p className="font-semibold text-gray-900">
            {formatCurrency(debt.currentPrincipal)} <span className="text-gray-500 font-normal">/ {formatCurrency(debt.originalPrincipal)}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Próximo pago</p>
          <p className="font-semibold text-gray-900">{debt.nextDueDate ? formatDate(debt.nextDueDate) : "—"}</p>
        </div>
      </div>

      <DebtProgress progress={progress.progress} size="md" showLabel={true} />

      <button
        onClick={onClick}
        className="w-full py-2 text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        Ver detalles →
      </button>
    </div>
  );
}
