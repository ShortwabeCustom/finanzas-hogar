import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DebtInstallment {
  id: string;
  sequence: number;
  dueDate: string;
  expectedAmount: number;
  totalPaid: number;
  status: string;
}

interface InstallmentTableProps {
  installments: DebtInstallment[];
}

const INSTALLMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcialmente Pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const INSTALLMENT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function InstallmentTable({ installments }: InstallmentTableProps) {
  if (installments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Sin cuotas registradas</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">#</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Fecha de Vencimiento</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Monto Esperado</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Pagado</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Saldo Cuota</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Estado</th>
          </tr>
        </thead>
        <tbody>
          {installments.map((installment) => {
            const balanceRemaining = installment.expectedAmount - installment.totalPaid;

            return (
              <tr key={installment.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{installment.sequence}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(installment.dueDate)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(installment.expectedAmount)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-green-600">{formatCurrency(installment.totalPaid)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(balanceRemaining)}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge
                    status={installment.status}
                    labels={INSTALLMENT_STATUS_LABELS}
                    styles={INSTALLMENT_STATUS_STYLES}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
