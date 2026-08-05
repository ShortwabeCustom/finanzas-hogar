"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Sheet from "@/components/ui/Sheet";
import { debtFormSchema } from "@/lib/validations/debt";
import { PERIOD_LABELS } from "@/lib/utils";
import { trackDebtEvent, getAmountBucket } from "@/lib/analytics";
import { toDateInputValue, getTodayDateInputValue } from "@/lib/forms/date-helpers";

interface DebtFormSheetProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  debtId?: string;
}

interface PersonalCard {
  id: string;
  lastFourDigits: string;
  issuer: string;
}

const DEBT_TYPES = [
  { value: "PERSONAL_LOAN", label: "Préstamo Personal" },
  { value: "CREDIT_CARD", label: "Tarjeta de Crédito" },
  { value: "AUTO_LOAN", label: "Préstamo Auto" },
  { value: "MORTGAGE", label: "Hipoteca" },
  { value: "BNPL", label: "Compra Ahora Paga Después" },
  { value: "FAMILY_LOAN", label: "Préstamo Familiar" },
  { value: "LOAN_GRANTED", label: "Préstamo Otorgado" },
  { value: "OTHER", label: "Otro" },
];

export default function DebtFormSheet({ open, onClose, onSuccess, debtId }: DebtFormSheetProps) {
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const [direction, setDirection] = useState<"PAYABLE" | "RECEIVABLE" | "">("PAYABLE");
  const [formData, setFormData] = useState({
    type: "",
    name: "",
    counterpartyName: "",
    originalPrincipal: "",
    currentPrincipal: "",
    annualInterestRate: "",
    scheduleMode: "FREE",
    paymentFrequency: "",
    scheduledPayment: "",
    numberOfInstallments: "",
    startDate: getTodayDateInputValue(),
    estimatedEndDate: "",
    personalCardId: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchCards();
      if (debtId) {
        fetchDebtData();
      }
    }
  }, [open, debtId]);

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

  const fetchDebtData = async () => {
    try {
      const res = await fetch(`/api/personal/debts/${debtId}`);
      if (res.ok) {
        const data = await res.json();
        setDirection(data.direction);
        setFormData({
          type: data.type,
          name: data.name,
          counterpartyName: data.counterpartyName || "",
          originalPrincipal: data.originalPrincipal.toString(),
          currentPrincipal: data.currentPrincipal.toString(),
          annualInterestRate: data.annualInterestRate?.toString() || "",
          scheduleMode: data.scheduleMode,
          paymentFrequency: data.paymentFrequency || "",
          scheduledPayment: data.scheduledPayment?.toString() || "",
          numberOfInstallments: data.numberOfInstallments?.toString() || "",
          startDate: toDateInputValue(data.startDate),
          estimatedEndDate: toDateInputValue(data.estimatedEndDate) || "",
          personalCardId: data.personalCardId || "",
          notes: data.notes || "",
        });
      }
    } catch (err) {
      console.error("Error fetching debt:", err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const payload = {
      direction,
      ...formData,
      originalPrincipal: Number(formData.originalPrincipal),
      currentPrincipal: Number(formData.currentPrincipal),
      annualInterestRate: formData.annualInterestRate ? Number(formData.annualInterestRate) : null,
      paymentFrequency: formData.paymentFrequency || null,
      scheduledPayment: formData.scheduledPayment ? Number(formData.scheduledPayment) : null,
      numberOfInstallments: formData.numberOfInstallments ? Number(formData.numberOfInstallments) : null,
      counterpartyName: formData.counterpartyName || null,
      estimatedEndDate: formData.estimatedEndDate || null,
      personalCardId: formData.personalCardId || null,
    };

    try {
      const validData = debtFormSchema.parse(payload);
      setLoading(true);

      const method = debtId ? "PATCH" : "POST";
      const url = debtId ? `/api/personal/debts/${debtId}` : "/api/personal/debts";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al guardar la deuda");
      }

      toast.success(debtId ? "Deuda actualizada exitosamente" : "Deuda creada exitosamente");

      // Analytics tracking
      if (debtId) {
        trackDebtEvent('debt_edited', {
          type: payload.type as any,
          field_changed: 'general', // Could be enhanced to track specific fields
        });
      } else {
        trackDebtEvent('debt_created', {
          direction: direction as any,
          type: payload.type as any,
          amount_bucket: getAmountBucket(Number(payload.originalPrincipal)),
        });
      }

      onClose();
      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        // Zod validation error
        if ("errors" in err && Array.isArray((err as any).errors)) {
          const zodError = err as any;
          const newErrors: Record<string, string> = {};
          const errorMessages: string[] = [];

          zodError.errors?.forEach((e: any) => {
            const fieldName = e.path[0] || "unknown";
            newErrors[fieldName] = e.message;

            // Build friendly error message
            const fieldLabel = fieldName.replace(/([A-Z])/g, " $1").toLowerCase();
            errorMessages.push(`${fieldLabel}: ${e.message}`);
          });

          setErrors(newErrors);

          // Show summary toast and scroll to first error
          toast.error("Revisa los campos marcados");
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

  return (
    <Sheet open={open} onClose={onClose} title={debtId ? "Editar deuda" : "Nueva deuda o préstamo"} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Direction Radio Buttons (solo en modo crear) */}
        {!debtId && (
          <fieldset className="space-y-2">
            <label className="block text-sm font-medium text-gray-900">¿Qué deseas registrar?</label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="direction"
                  value="PAYABLE"
                  checked={direction === "PAYABLE"}
                  onChange={(e) => setDirection(e.target.value as "PAYABLE" | "RECEIVABLE")}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Una deuda que debo pagar</span>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="direction"
                  value="RECEIVABLE"
                  checked={direction === "RECEIVABLE"}
                  onChange={(e) => setDirection(e.target.value as "PAYABLE" | "RECEIVABLE")}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">Un préstamo que debo cobrar</span>
              </label>
            </div>
          </fieldset>
        )}

        {/* Basic Fields */}
        <div className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
              Nombre <span className="text-red-600">*</span>
            </label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Ej. Crédito Azteca"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-describedby={errors.name ? "name-error" : undefined}
            />
            {errors.name && (
              <p id="name-error" className="text-xs text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="counterpartyName" className="block text-sm font-medium text-gray-900 mb-1">
              Contraparte (opcional)
            </label>
            <input
              id="counterpartyName"
              type="text"
              name="counterpartyName"
              value={formData.counterpartyName}
              onChange={handleInputChange}
              placeholder="Ej. Banco Azteca"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-900 mb-1">
              Tipo <span className="text-red-600">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecciona un tipo</option>
              {DEBT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type}</p>}
          </div>
        </div>

        {/* Amount Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="originalPrincipal" className="block text-sm font-medium text-gray-900 mb-1">
              Monto Original <span className="text-red-600">*</span>
            </label>
            <input
              id="originalPrincipal"
              type="number"
              name="originalPrincipal"
              value={formData.originalPrincipal}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.originalPrincipal && <p className="text-xs text-red-600 mt-1">{errors.originalPrincipal}</p>}
          </div>

          <div>
            <label htmlFor="currentPrincipal" className="block text-sm font-medium text-gray-900 mb-1">
              Saldo Actual <span className="text-red-600">*</span>
            </label>
            <input
              id="currentPrincipal"
              type="number"
              name="currentPrincipal"
              value={formData.currentPrincipal}
              onChange={handleInputChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.currentPrincipal && <p className="text-xs text-red-600 mt-1">{errors.currentPrincipal}</p>}
          </div>
        </div>

        {/* Date Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-900 mb-1">
              Fecha de Inicio <span className="text-red-600">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="estimatedEndDate" className="block text-sm font-medium text-gray-900 mb-1">
              Fecha Estimada de Liquidación (opcional)
            </label>
            <input
              id="estimatedEndDate"
              type="date"
              name="estimatedEndDate"
              value={formData.estimatedEndDate}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Interest Rate */}
        <div>
          <label htmlFor="annualInterestRate" className="block text-sm font-medium text-gray-900 mb-1">
            Tasa Anual (opcional, %)
          </label>
          <input
            id="annualInterestRate"
            type="number"
            name="annualInterestRate"
            value={formData.annualInterestRate}
            onChange={handleInputChange}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Schedule Mode */}
        <fieldset className="space-y-2">
          <label className="block text-sm font-medium text-gray-900">Modalidad</label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="scheduleMode"
                value="FREE"
                checked={formData.scheduleMode === "FREE"}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Seguimiento libre</span>
            </label>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="scheduleMode"
                value="INSTALLMENTS"
                checked={formData.scheduleMode === "INSTALLMENTS"}
                onChange={handleInputChange}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">Calendario de cuotas</span>
            </label>
          </div>
        </fieldset>

        {/* Installment Fields (si INSTALLMENTS) */}
        {formData.scheduleMode === "INSTALLMENTS" && (
          <div className="space-y-3 p-4 bg-indigo-50 rounded-lg">
            <div>
              <label htmlFor="paymentFrequency" className="block text-sm font-medium text-gray-900 mb-1">
                Frecuencia <span className="text-red-600">*</span>
              </label>
              <select
                id="paymentFrequency"
                name="paymentFrequency"
                value={formData.paymentFrequency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecciona frecuencia</option>
                {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="scheduledPayment" className="block text-sm font-medium text-gray-900 mb-1">
                  Monto por Cuota (opcional)
                </label>
                <input
                  id="scheduledPayment"
                  type="number"
                  name="scheduledPayment"
                  value={formData.scheduledPayment}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="numberOfInstallments" className="block text-sm font-medium text-gray-900 mb-1">
                  Número de Cuotas (opcional)
                </label>
                <input
                  id="numberOfInstallments"
                  type="number"
                  name="numberOfInstallments"
                  value={formData.numberOfInstallments}
                  onChange={handleInputChange}
                  placeholder="12"
                  step="1"
                  min="1"
                  max="360"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Card Selection */}
        <div>
          <label htmlFor="personalCardId" className="block text-sm font-medium text-gray-900 mb-1">
            Tarjeta o Cuenta Asociada (opcional)
          </label>
          <select
            id="personalCardId"
            name="personalCardId"
            value={formData.personalCardId}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Sin asociar</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.issuer} •••• {card.lastFourDigits}
              </option>
            ))}
          </select>
        </div>

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
            placeholder="Ej. Deuda con intereses del 12% anual"
            rows={3}
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
            disabled={loading}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
