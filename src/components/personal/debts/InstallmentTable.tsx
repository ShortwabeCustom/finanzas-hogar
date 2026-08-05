import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  DEBT_INSTALLMENT_STATUS_LABELS,
  DEBT_INSTALLMENT_STATUS_COLORS,
} from "@/lib/financial/debt-labels";

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
                    labels={DEBT_INSTALLMENT_STATUS_LABELS}
                    styles={DEBT_INSTALLMENT_STATUS_COLORS}
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
