"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/ui/Sheet";
import { debtPaymentSchema } from "@/lib/validations/debt";
import { PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import { getTodayDateInputValue } from "@/lib/forms/date-helpers";

interface DebtPaymentSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debtId: string;
  currentBalance: number | string | any;
}

interface PersonalCard {
  id: string;
  lastFourDigits: string;
  issuer: string;
}

interface DebtInstallment {
  id: string;
  sequence: number;
  dueDate: string;
  status: string;
}

export default function DebtPaymentSheet({
  open,
  onClose,
  onSuccess,
  debtId,
  currentBalance,
}: DebtPaymentSheetProps) {
  // Convert Decimal or string to number
  const balanceAsNumber = typeof currentBalance === 'number'
    ? currentBalance
    : typeof currentBalance === 'string'
      ? parseFloat(currentBalance)
      : Number(currentBalance?.toNumber?.() || currentBalance);

  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const [installments, setInstallments] = useState<DebtInstallment[]>([]);
  const [formData, setFormData] = useState({
    paidAt: getTodayDateInputValue(),
    principalAmount: "",
    interestAmount: "0",
    feeAmount: "0",
    penaltyAmount: "0",
    paymentMethod: "TRANSFER",
    personalCardId: "",
    installmentId: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchCards();
      fetchInstallments();
    }
  }, [open]);

  const fetchCards = async () => {
    try {
      const res = await fetch("/api/personal/cards");
      if (res.ok) {
        const data = await res.json();
        setCards(data);
      }
    } catch (err) {
      console.error("Error fetching cards:", err);
    }
  };

  const fetchInstallments = async () => {
    try {
      const res = await fetch(`/api/personal/debts/${debtId}/installments`);
      if (res.ok) {
        const data = await res.json();
        const unpaid = data.filter((i: DebtInstallment) => i.status !== "PAID" && i.status !== "CANCELLED");
        setInstallments(unpaid);
      }
    } catch (err) {
      console.error("Error fetching installments:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const getTotalAmount = (): number => {
    return (
      Number(formData.principalAmount || 0) +
      Number(formData.interestAmount || 0) +
      Number(formData.feeAmount || 0) +
      Number(formData.penaltyAmount || 0)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      paidAt: formData.paidAt,
      principalAmount: Number(formData.principalAmount),
      interestAmount: Number(formData.interestAmount),
      feeAmount: Number(formData.feeAmount),
      penaltyAmount: Number(formData.penaltyAmount),
      paymentMethod: formData.paymentMethod,
      personalCardId: formData.personalCardId || null,
      installmentId: formData.installmentId || null,
      notes: formData.notes || null,
    };

    try {
      const validData = debtPaymentSchema.parse(payload);
      setLoading(true);

      const res = await fetch(`/api/personal/debts/${debtId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al registrar el abono");
      }

      toast.success("Abono registrado exitosamente");

      // Analytics tracking
      const totalPayment = Number(formData.principalAmount) + Number(formData.interestAmount) + Number(formData.feeAmount) + Number(formData.penaltyAmount);
      trackEvent('debt_payment_recorded', {
        payment_method: payload.paymentMethod as any,
        portion: Number(formData.principalAmount) > 0 ? ('capital' as const) : ('interest' as const),
      });

      onClose();
      onSuccess();
      setFormData({
        paidAt: getTodayDateInputValue(),
        principalAmount: "",
        interestAmount: "0",
        feeAmount: "0",
        penaltyAmount: "0",
        paymentMethod: "TRANSFER",
        personalCardId: "",
        installmentId: "",
        notes: "",
      });
    } catch (err) {
      if (err instanceof Error) {
        // Zod validation error
        if ("errors" in err && Array.isArray((err as any).errors)) {
          const zodError = err as any;
          const newErrors: Record<string, string> = {};

          zodError.errors?.forEach((e: any) => {
            const fieldName = e.path[0] || "unknown";
            newErrors[fieldName] = e.message;
          });

          setErrors(newErrors);
          toast.error("Revisa los campos marcados");

          // Scroll to first error
          const firstErrorField = Object.keys(newErrors)[0];
          if (firstErrorField) {
            const element = document.getElementById(firstErrorField);
            element?.scrollIntoView({ behavior: "smooth", block: "center" });
            element?.focus();
          }
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Error desconocido");
      }
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = getTotalAmount();
  const isDecompositionValid = totalAmount > 0;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Registrar abono"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Date */}
        <div>
          <label htmlFor="paidAt" className="block text-sm font-medium text-gray-900 mb-1">
            Fecha de Pago <span className="text-red-600">*</span>
          </label>
          <input
            id="paidAt"
            type="date"
            name="paidAt"
            value={formData.paidAt}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Payment Breakdown */}
        <div className="space-y-3 p-4 bg-indigo-50 rounded-lg">
          <p className="text-sm font-medium text-gray-900">Desglose del Pago</p>

          <div>
            <label htmlFor="principalAmount" className="block text-sm font-medium text-gray-900 mb-1">
              Capital <span className="text-red-600">*</span>
            </label>
            <input
              id="principalAmount"
              type="number"
              name="principalAmount"
              value={formData.principalAmount}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              max={balanceAsNumber}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-describedby={errors.principalAmount ? "principal-error" : undefined}
            />
            {errors.principalAmount && (
              <p id="principal-error" className="text-xs text-red-600 mt-1">{errors.principalAmount}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Máximo: ${balanceAsNumber.toFixed(2)}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="interestAmount" className="block text-xs font-medium text-gray-900 mb-1">
                Interés
              </label>
              <input
                id="interestAmount"
                type="number"
                name="interestAmount"
                value={formData.interestAmount}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="feeAmount" className="block text-xs font-medium text-gray-900 mb-1">
                Comisión
              </label>
              <input
                id="feeAmount"
                type="number"
                name="feeAmount"
                value={formData.feeAmount}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="penaltyAmount" className="block text-xs font-medium text-gray-900 mb-1">
                Penalización
              </label>
              <input
                id="penaltyAmount"
                type="number"
                name="penaltyAmount"
                value={formData.penaltyAmount}
                onChange={handleInputChange}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Total Display */}
          <div className="p-3 bg-white rounded border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-900">Total:</span>
              <span className={`text-lg font-bold ${isDecompositionValid ? "text-indigo-600" : "text-red-600"}`}>
                ${totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Installment Selection (if available) */}
        {installments.length > 0 && (
          <div>
            <label htmlFor="installmentId" className="block text-sm font-medium text-gray-900 mb-1">
              Cuota Relacionada (opcional)
            </label>
            <select
              id="installmentId"
              name="installmentId"
              value={formData.installmentId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Sin asociar a cuota</option>
              {installments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  Cuota #{inst.sequence} - {inst.dueDate}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-900 mb-1">
            Forma de Pago <span className="text-red-600">*</span>
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            value={formData.paymentMethod}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Card Selection (if applicable) */}
        {["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"].includes(formData.paymentMethod) && cards.length > 0 && (
          <div>
            <label htmlFor="personalCardId" className="block text-sm font-medium text-gray-900 mb-1">
              Tarjeta o Cuenta
            </label>
            <select
              id="personalCardId"
              name="personalCardId"
              value={formData.personalCardId}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecciona una tarjeta</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.issuer} •••• {card.lastFourDigits}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-900 mb-1">
            Notas (opcional)
          </label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleInputChange}
            placeholder="Ej. Pago realizado en oficina"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !isDecompositionValid}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Registrando..." : "Registrar abono"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
