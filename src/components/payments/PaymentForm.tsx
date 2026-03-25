"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentInput } from "@/lib/validations";
import { PERIOD_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/utils";

interface Category { id: string; name: string; color: string; }
interface User { id: string; name: string | null; email: string; }
interface PersonalCard {
  id: string;
  bankName: string;
  cardName: string;
  last4Digits: string;
  paymentSourceType: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";
}

interface PaymentFormProps {
  defaultValues?: Partial<PaymentInput & { id: string; folio: string }>;
  categories: Category[];
  users: User[];
  onSubmit: (data: PaymentInput, receiptFile?: File) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const CARD_METHODS = ["CREDIT_CARD", "DEBIT_CARD", "TRANSFER"];

const CARD_FIELD_LABELS: Record<string, string> = {
  CREDIT_CARD: "Tarjeta de crédito asociada",
  DEBIT_CARD: "Tarjeta de débito asociada",
  TRANSFER: "Cuenta de transferencia asociada",
};

const CARD_FIELD_EMPTY: Record<string, string> = {
  CREDIT_CARD: "El usuario no tiene tarjetas de crédito registradas.",
  DEBIT_CARD: "El usuario no tiene tarjetas de débito registradas.",
  TRANSFER: "El usuario no tiene cuentas bancarias registradas.",
};

export default function PaymentForm({
  defaultValues,
  categories,
  users,
  onSubmit,
  onCancel,
  isEdit = false,
}: PaymentFormProps) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(defaultValues?.receipt ?? null);
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const isInitialMount = useRef(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      concept: defaultValues?.concept ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      amount: defaultValues?.amount ?? 0,
      paymentDate: defaultValues?.paymentDate ?? "",
      dueDate: defaultValues?.dueDate ?? "",
      period: defaultValues?.period ?? "MONTHLY",
      status: defaultValues?.status ?? "PENDING",
      paymentMethod: defaultValues?.paymentMethod ?? "CASH",
      paidById: defaultValues?.paidById ?? "",
      personalCardId: defaultValues?.personalCardId ?? "",
      receipt: defaultValues?.receipt ?? "",
      comments: defaultValues?.comments ?? "",
    },
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const paidById = useWatch({ control, name: "paidById" });
  const showCardField = CARD_METHODS.includes(paymentMethod) && !!paidById;

  // Fetch compatible cards when method or user changes
  useEffect(() => {
    if (!showCardField) {
      setCards([]);
      return;
    }
    fetch(`/api/personal/cards?userId=${paidById}&method=${paymentMethod}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCards(Array.isArray(d) ? d : []));
  }, [showCardField, paidById, paymentMethod]);

  // Reset card selection when user or method changes (skip initial mount to preserve edit values)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setValue("personalCardId", "");
  }, [paidById, paymentMethod, setValue]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleFormSubmit(data: PaymentInput) {
    await onSubmit(data, receiptFile ?? undefined);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
      {defaultValues?.folio && (
        <div className="p-3 bg-indigo-50 rounded-lg text-sm">
          <span className="text-gray-500">Folio:</span>{" "}
          <span className="font-mono font-bold text-indigo-700">{defaultValues.folio}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Nombre */}
        <div className="col-span-2">
          <label className="label">Nombre / Descripción *</label>
          <input className="input" placeholder="Ej: Pago de luz" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>

        {/* Concepto */}
        <div className="col-span-2">
          <label className="label">Concepto *</label>
          <input className="input" placeholder="Ej: Servicio eléctrico mes de marzo" {...register("concept")} />
          {errors.concept && <p className="mt-1 text-xs text-red-600">{errors.concept.message}</p>}
        </div>

        {/* Categoría */}
        <div>
          <label className="label">Categoría *</label>
          <select className="input" {...register("categoryId")}>
            <option value="">Selecciona...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>}
        </div>

        {/* Monto */}
        <div>
          <label className="label">Monto *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
            <input type="number" step="0.01" className="input pl-7" placeholder="0.00" {...register("amount")} />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
        </div>

        {/* Fecha de pago */}
        <div>
          <label className="label">Fecha de pago</label>
          <input type="date" className="input" {...register("paymentDate")} />
        </div>

        {/* Fecha límite */}
        <div>
          <label className="label">Fecha límite</label>
          <input type="date" className="input" {...register("dueDate")} />
        </div>

        {/* Periodo */}
        <div>
          <label className="label">Periodo</label>
          <select className="input" {...register("period")}>
            {Object.entries(PERIOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Estado */}
        <div>
          <label className="label">Cumplimiento / Estado</label>
          <select className="input" {...register("status")}>
            <option value="PENDING">Pendiente</option>
            <option value="PAID">Pagado</option>
            <option value="OVERDUE">Vencido</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </div>

        {/* Forma de pago */}
        <div>
          <label className="label">Forma de pago</label>
          <select className="input" {...register("paymentMethod")}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Pagado por */}
        <div>
          <label className="label">Pagado por</label>
          <select className="input" {...register("paidById")}>
            <option value="">Sin asignar</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
            ))}
          </select>
        </div>

        {/* Medio de pago asociado (condicional) */}
        {showCardField && (
          <div className="col-span-2">
            <label className="label">{CARD_FIELD_LABELS[paymentMethod] ?? "Medio de pago asociado"}</label>
            {cards.length === 0 ? (
              <div className="mt-1 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700">
                {CARD_FIELD_EMPTY[paymentMethod] ?? "Sin medios de pago disponibles."}
                {" "}Agrégalos desde{" "}
                <a href="/personal/cards" target="_blank" className="font-medium underline hover:text-amber-800">
                  Mis Tarjetas
                </a>.
              </div>
            ) : (
              <select className="input" {...register("personalCardId")}>
                <option value="">Sin medio asociado</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.bankName} — {c.cardName} •••• {c.last4Digits}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Comprobante */}
        <div className="col-span-2">
          <label className="label">Comprobante (JPG / PNG)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {previewUrl && (
            <div className="mt-2">
              <img src={previewUrl} alt="Comprobante" className="max-h-40 rounded-lg border border-gray-200 object-contain" />
            </div>
          )}
        </div>

        {/* Comentarios */}
        <div className="col-span-2">
          <label className="label">Comentarios</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Notas adicionales..."
            {...register("comments")}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar pago" : "Registrar pago"}
        </button>
      </div>
    </form>
  );
}
