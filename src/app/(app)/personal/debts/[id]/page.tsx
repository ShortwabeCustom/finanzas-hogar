"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DebtPaymentHistory from "@/components/personal/debts/DebtPaymentHistory";
import InstallmentTable from "@/components/personal/debts/InstallmentTable";
import DebtFormSheet from "@/components/personal/debts/DebtFormSheet";
import DebtPaymentSheet from "@/components/personal/debts/DebtPaymentSheet";
import StatusBadge from "@/components/ui/StatusBadge";
import DebtProgress from "@/components/personal/debts/DebtProgress";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { calculateDebtProgress, calculateDebtTotals } from "@/lib/financial/debt-calculations";

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
  estimatedEndDate: string | null;
  annualInterestRate: number | null;
  scheduleMode: "FREE" | "INSTALLMENTS";
  personalCardId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DebtPayment {
  id: string;
  paidAt: string;
  principalAmount: number;
  interestAmount: number;
  feeAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  personalPayment: {
    folio: string;
    paymentMethod: string;
  };
}

interface DebtInstallment {
  id: string;
  sequence: number;
  dueDate: string;
  expectedAmount: number;
  totalPaid: number;
  status: string;
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

export default function DebtDetailPage() {
  const params = useParams();
  const router = useRouter();
  const debtId = params.id as string;

  const [debt, setDebt] = useState<DebtAccount | null>(null);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [installments, setInstallments] = useState<DebtInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (debtId) {
      fetchData();
    }
  }, [debtId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [debtRes, paymentsRes, installmentsRes] = await Promise.all([
        fetch(`/api/personal/debts/${debtId}`),
        fetch(`/api/personal/debts/${debtId}/payments`),
        fetch(`/api/personal/debts/${debtId}/installments`),
      ]);

      if (!debtRes.ok) {
        throw new Error("No se encontró la deuda");
      }

      const debtData = await debtRes.json();
      setDebt(debtData);

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
      }

      if (installmentsRes.ok) {
        const installmentsData = await installmentsRes.json();
        setInstallments(installmentsData);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar datos");
      toast.error("Error al cargar la deuda");
    } finally {
      setLoading(false);
    }
  };

  const handleDebtUpdated = () => {
    setEditSheetOpen(false);
    fetchData();
  };

  const handlePaymentRegistered = () => {
    setPaymentSheetOpen(false);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !debt) {
    return (
      <div className="card p-6 text-center text-red-600">
        <p>{error || "No se encontró la deuda"}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Volver atrás
        </button>
      </div>
    );
  }

  const progress = calculateDebtProgress(debt.originalPrincipal, debt.originalPrincipal - debt.currentPrincipal);
  // Cast to avoid type mismatch - the API returns numbers but calculateDebtTotals expects Decimal
  const totals = calculateDebtTotals(debt.originalPrincipal as any, payments as any);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{debt.name}</h1>
            {debt.counterpartyName && (
              <p className="text-sm text-gray-500 mt-1">{debt.counterpartyName}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                {debt.type}
              </span>
              <StatusBadge
                status={debt.status}
                labels={STATUS_LABELS}
                styles={STATUS_BADGE_STYLES}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 relative">
            <button
              onClick={() => setPaymentSheetOpen(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Registrar abono
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Más opciones"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <button
                    onClick={() => {
                      setEditSheetOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900 border-b border-gray-200"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      toast.success("Funcionalidad próxima: Asociar movimiento");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900 border-b border-gray-200"
                  >
                    Asociar movimiento
                  </button>
                  <button
                    onClick={() => {
                      toast.success("Funcionalidad próxima: Pausar");
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm text-gray-900 border-b border-gray-200"
                  >
                    Pausar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-6 space-y-3">
          <div>
            <p className="text-sm text-gray-500">Monto Original</p>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(debt.originalPrincipal)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Saldo Pendiente</p>
            <p className={cn("text-2xl font-bold", debt.currentPrincipal > debt.originalPrincipal * 0.7 ? "text-red-600" : "text-gray-900")}>
              {formatCurrency(debt.currentPrincipal)}
            </p>
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <div>
            <p className="text-sm text-gray-500">Capital Pagado</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.principalPaid.toNumber())}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Intereses + Comisiones</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(totals.interestPaid.toNumber() + totals.feesPaid.toNumber())}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="card p-6">
        <p className="text-sm font-medium text-gray-900 mb-3">Progreso de Pago</p>
        <DebtProgress progress={progress.progress} size="lg" showLabel={true} />
      </div>

      {/* Installments Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Cuotas</h2>
          {debt.scheduleMode === "FREE" && (
            <button
              onClick={() => toast.success("Funcionalidad próxima: Generar calendario")}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Generar calendario
            </button>
          )}
        </div>

        {installments.length === 0 && debt.scheduleMode === "FREE" ? (
          <div className="text-center py-8 text-gray-500">
            <p>Esta deuda utiliza seguimiento libre y no tiene cuotas programadas.</p>
          </div>
        ) : installments.length > 0 ? (
          <InstallmentTable installments={installments} />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Sin cuotas registradas</p>
          </div>
        )}
      </div>

      {/* Payment History Section */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de Pagos</h2>
        <DebtPaymentHistory payments={payments} />
      </div>

      {/* Edit Debt Form Sheet */}
      <DebtFormSheet
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        onSuccess={handleDebtUpdated}
        debtId={debtId}
      />

      {/* Payment Registration Sheet */}
      <DebtPaymentSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        onSuccess={handlePaymentRegistered}
        debtId={debtId}
        currentBalance={debt.currentPrincipal}
      />
    </div>
  );
}
