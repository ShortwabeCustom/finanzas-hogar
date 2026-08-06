"use client";

interface Transaction {
  id?: string;
  date: string;
  description: string;
  amount: number;
  type?: "debit" | "credit";
  balance?: number;
}

interface TransactionPreviewTableProps {
  transactions: Transaction[];
  bankName?: string;
  period?: string;
  onAccountSelect?: (accountId: string) => void;
  selectedAccountId?: string;
  isLoadingAccounts?: boolean;
  accounts?: Array<{ id: string; name: string }>;
}

export default function TransactionPreviewTable({
  transactions,
  bankName,
  period,
  onAccountSelect,
  selectedAccountId,
  isLoadingAccounts,
  accounts = [],
}: TransactionPreviewTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("es-CL", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revisar transacciones</h3>
        {bankName && period && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <p className="text-sm text-blue-900">
                <span className="font-semibold">{bankName}</span> • Período {period}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                {transactions.length} transacción{transactions.length !== 1 ? "es" : ""} encontradas
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Account selector */}
      {onAccountSelect && accounts.length > 0 && (
        <div>
          <label htmlFor="account" className="block text-sm font-medium text-gray-900 mb-2">
            Vincular a cuenta
          </label>
          <select
            id="account"
            value={selectedAccountId || ""}
            onChange={(e) => onAccountSelect(e.target.value)}
            disabled={isLoadingAccounts}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Selecciona una cuenta...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-3 font-semibold text-gray-900 w-24">Fecha</th>
              <th className="text-left py-3 px-3 font-semibold text-gray-900 flex-1">Descripción</th>
              <th className="text-right py-3 px-3 font-semibold text-gray-900 w-32">Monto</th>
              {transactions.some((t) => t.balance !== undefined) && (
                <th className="text-right py-3 px-3 font-semibold text-gray-900 w-32">Saldo</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.slice(0, 10).map((tx, idx) => (
              <tr key={tx.id || idx} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 px-3 text-gray-600">{formatDate(tx.date)}</td>
                <td className="py-3 px-3 text-gray-900 font-medium truncate">{tx.description}</td>
                <td
                  className={`py-3 px-3 text-right font-medium ${
                    tx.type === "debit" || tx.amount < 0
                      ? "text-red-600"
                      : tx.type === "credit" || tx.amount > 0
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}
                >
                  {tx.type === "debit" || tx.amount < 0 ? "- " : "+ "}
                  {formatCurrency(Math.abs(tx.amount))}
                </td>
                {tx.balance !== undefined && (
                  <td className="py-3 px-3 text-right text-gray-600">{formatCurrency(tx.balance)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length > 10 && (
        <p className="text-sm text-gray-500 text-center py-2">
          Mostrando 10 de {transactions.length} transacciones
        </p>
      )}

      {/* Merge option */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            defaultChecked={true}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
          />
          <span className="text-sm text-gray-900 font-medium">
            Combinar con transacciones existentes de este período
          </span>
        </label>
        <p className="text-xs text-gray-600 mt-2">
          Si el período ya existe, las nuevas transacciones se añadirán sin duplicar
        </p>
      </div>
    </div>
  );
}
