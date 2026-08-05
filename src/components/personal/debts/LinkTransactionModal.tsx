"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/utils";
import { trackDebtEvent } from "@/lib/analytics";

interface DebtAccount {
  id: string;
  name: string;
  type: string;
  direction: "PAYABLE" | "RECEIVABLE";
  status: string;
  currentPrincipal: number;
}

interface LinkTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  transaction: {
    id: string;
    description: string;
    chargeAmount: number | null;
    creditAmount: number | null;
    transactionDate: string;
  } | null;
  debtAccounts: DebtAccount[];
}

export default function LinkTransactionModal({
  open,
  onClose,
  onSuccess,
  transaction,
  debtAccounts,
}: LinkTransactionModalProps) {
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form breakdown
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestAmount, setInterestAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [isPartial, setIsPartial] = useState(false);

  if (!transaction) return null;

  const transactionAmount =
    (transaction.chargeAmount || 0) + (transaction.creditAmount || 0);

  // Filter debts: only PAYABLE and ACTIVE
  const availableDebts = debtAccounts.filter(
    (debt) => debt.direction === "PAYABLE" && debt.status === "ACTIVE"
  );

  const selectedDebt = availableDebts.find((d) => d.id === selectedDebtId);

  // Calculate total breakdown
  const totalBreakdown =
    (Number(principalAmount) || 0) +
    (Number(interestAmount) || 0) +
    (Number(feeAmount) || 0) +
    (Number(penaltyAmount) || 0);

  const isValid =
    selectedDebtId &&
    Number(principalAmount) > 0 &&
    !loading &&
    totalBreakdown > 0;

  function handleClose() {
    setSelectedDebtId("");
    setPrincipalAmount("");
    setInterestAmount("");
    setFeeAmount("");
    setPenaltyAmount("");
    setNotes("");
    setIsPartial(false);
    setError(null);
    onClose();
  }

  async function handleLink() {
    if (!selectedDebtId || !principalAmount || !transaction) return;

    setLoading(true);
    setError(null);

    try {
      const principal = Number(principalAmount);

      // Validate principal doesn't exceed debt balance
      if (selectedDebt && principal > selectedDebt.currentPrincipal) {
        throw new Error(
          `El capital no puede superar el saldo pendiente (${formatCurrency(selectedDebt.currentPrincipal)})`
        );
      }

      const res = await fetch(
        `/api/personal/debts/${selectedDebtId}/link-transaction`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bankTransactionId: transaction.id,
            principalAmount: principal,
            interestAmount: Number(interestAmount) || 0,
            feeAmount: Number(feeAmount) || 0,
            penaltyAmount: Number(penaltyAmount) || 0,
            notes: notes || null,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "No se pudo vincular la transacción a la deuda"
        );
      }

      // Track event
      trackDebtEvent("debt_transaction_linked", {
        transaction_amount: totalBreakdown,
        partial: isPartial,
      });

      toast.success("Transacción vinculada correctamente");
      handleClose();
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al vincular la transacción";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Vincular a Deuda" size="md">
      <div className="px-6 py-5 space-y-4">
        {/* Transaction summary */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Transacción
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {transaction.description}
          </p>
          <div className="mt-2 flex gap-4 text-sm">
            {transaction.chargeAmount && transaction.chargeAmount > 0 && (
              <span className="text-red-600">
                Cargo: {formatCurrency(transaction.chargeAmount)}
              </span>
            )}
            {transaction.creditAmount && transaction.creditAmount > 0 && (
              <span className="text-green-600">
                Abono: {formatCurrency(transaction.creditAmount)}
              </span>
            )}
          </div>
        </div>

        {/* Debt selector */}
        <div className="space-y-1">
          <label htmlFor="debt-select" className="text-sm font-medium text-gray-700">
            Deuda
          </label>
          <select
            id="debt-select"
            className="input w-full"
            value={selectedDebtId}
            onChange={(e) => setSelectedDebtId(e.target.value)}
            disabled={loading || availableDebts.length === 0}
          >
            <option value="">Selecciona una deuda</option>
            {availableDebts.map((debt) => (
              <option key={debt.id} value={debt.id}>
                {debt.name} (Saldo: {formatCurrency(debt.currentPrincipal)})
              </option>
            ))}
          </select>
          {availableDebts.length === 0 && (
            <p className="text-xs text-gray-400">
              No hay deudas activas disponibles
            </p>
          )}
        </div>

        {/* Breakdown fields */}
        {selectedDebtId && (
          <>
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">
                Desglose del pago
              </p>

              <div className="space-y-2">
                <div>
                  <label
                    htmlFor="principal"
                    className="text-xs font-medium text-gray-600"
                  >
                    Capital
                  </label>
                  <input
                    id="principal"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-full"
                    placeholder="0.00"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    disabled={loading}
                  />
                  {selectedDebt && Number(principalAmount) > selectedDebt.currentPrincipal && (
                    <p className="mt-1 text-xs text-red-600">
                      No puede exceder {formatCurrency(selectedDebt.currentPrincipal)}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="interest"
                    className="text-xs font-medium text-gray-600"
                  >
                    Interés
                  </label>
                  <input
                    id="interest"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-full"
                    placeholder="0.00"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="fee" className="text-xs font-medium text-gray-600">
                    Comisiones
                  </label>
                  <input
                    id="fee"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-full"
                    placeholder="0.00"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="penalty"
                    className="text-xs font-medium text-gray-600"
                  >
                    Penalizaciones
                  </label>
                  <input
                    id="penalty"
                    type="number"
                    min="0"
                    step="0.01"
                    className="input w-full"
                    placeholder="0.00"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="rounded-lg bg-white px-2 py-2 text-sm font-semibold text-gray-900">
                Total: {formatCurrency(totalBreakdown)}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="notes" className="text-sm font-medium text-gray-700">
                Notas (opcional)
              </label>
              <textarea
                id="notes"
                className="input w-full resize-none"
                placeholder="Información adicional sobre este pago"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                maxLength={500}
              />
            </div>

            {/* Partial checkbox */}
            <label className="flex items-start gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={isPartial}
                onChange={(e) => setIsPartial(e.target.checked)}
                disabled={loading}
              />
              <span>Vincular solo parcialmente</span>
            </label>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleLink}
            className="btn-primary"
            disabled={!isValid}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                Vinculando...
              </span>
            ) : (
              "Vincular"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
