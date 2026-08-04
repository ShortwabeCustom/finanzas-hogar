"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from "@/lib/utils";

interface PersonalPayment {
  folio: string;
  paymentMethod: string;
}

interface DebtPayment {
  id: string;
  paidAt: string;
  principalAmount: number;
  interestAmount: number;
  feeAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  personalPayment: PersonalPayment;
}

interface DebtPaymentHistoryProps {
  payments: DebtPayment[];
}

const PAYMENT_METHOD_STYLES: Record<string, string> = {
  CASH: "bg-green-100 text-green-800",
  CREDIT_CARD: "bg-blue-100 text-blue-800",
  DEBIT_CARD: "bg-purple-100 text-purple-800",
  TRANSFER: "bg-indigo-100 text-indigo-800",
  CHECK: "bg-gray-100 text-gray-800",
  OTHER: "bg-gray-100 text-gray-800",
};

export default function DebtPaymentHistory({ payments }: DebtPaymentHistoryProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Aún no se han registrado abonos.</p>
      </div>
    );
  }

  const toggleRow = (paymentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(paymentId)) {
      newExpanded.delete(paymentId);
    } else {
      newExpanded.add(paymentId);
    }
    setExpandedRows(newExpanded);
  };

  return (
    <div className="space-y-2">
      {payments.map((payment) => (
        <div key={payment.id} className="border border-gray-200 rounded-lg">
          {/* Payment Row */}
          <div className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="flex-1" onClick={() => toggleRow(payment.id)}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="font-medium text-gray-900">{payment.personalPayment.folio}</p>
                  <p className="text-sm text-gray-500">{formatDate(payment.paidAt)}</p>
                </div>
              </div>
            </div>

            <div className="text-right mr-4">
              <p className="font-semibold text-gray-900">{formatCurrency(payment.totalAmount)}</p>
              <p className="text-sm text-gray-500">
                Capital: {formatCurrency(payment.principalAmount)}
              </p>
            </div>

            <button
              onClick={() => toggleRow(payment.id)}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Expandir detalles"
            >
              <svg
                className={`w-5 h-5 transition-transform ${expandedRows.has(payment.id) ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>

          {/* Expanded Details */}
          {expandedRows.has(payment.id) && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500">Capital</p>
                  <p className="font-medium text-gray-900">{formatCurrency(payment.principalAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Interés</p>
                  <p className="font-medium text-gray-900">{formatCurrency(payment.interestAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Comisión</p>
                  <p className="font-medium text-gray-900">{formatCurrency(payment.feeAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Penalización</p>
                  <p className="font-medium text-gray-900">{formatCurrency(payment.penaltyAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Forma de Pago</p>
                  <StatusBadge
                    status={payment.personalPayment.paymentMethod}
                    labels={PAYMENT_METHOD_LABELS}
                    styles={PAYMENT_METHOD_STYLES}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-gray-200 mt-3">
                <button
                  onClick={() => toast.success("Funcionalidad próxima: Editar pago")}
                  className="flex-1 py-2 text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-white rounded transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => toast.success("Funcionalidad próxima: Eliminar pago")}
                  className="flex-1 py-2 text-center text-xs font-medium text-red-600 hover:text-red-700 hover:bg-white rounded transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
