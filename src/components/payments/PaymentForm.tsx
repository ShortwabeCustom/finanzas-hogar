"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentInput } from "@/lib/validations";
import { PERIOD_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { resolveReceiptUrl } from "@/lib/receipt";

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
  TRANSFER: "Cuenta o tarjeta de débito asociada",
};

const CARD_FIELD_EMPTY: Record<string, string> = {
  CREDIT_CARD: "El usuario no tiene tarjetas de crédito registradas.",
  DEBIT_CARD: "El usuario no tiene tarjetas de débito registradas.",
  TRANSFER: "El usuario no tiene cuentas bancarias ni tarjetas de débito registradas.",
};

export default function PaymentForm({
  defaultValues,
  categories,
  users,
  onSubmit,
  onCancel,
  isEdit = false,
}: PaymentFormProps) {
  const buildFormValues = () => ({
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
    receipt: resolveReceiptUrl(defaultValues?.receipt) ?? "",
    comments: defaultValues?.comments ?? "",
  });

  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(resolveReceiptUrl(defaultValues?.receipt) ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const isInitialMount = useRef(true);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    reset,
  } = useForm<PaymentInput>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: buildFormValues(),
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const paidById = useWatch({ control, name: "paidById" });
  const showCardField = CARD_METHODS.includes(paymentMethod) && !!paidById;

  // Fetch compatible cards when method or user changes
  useEffect(() => {
    reset(buildFormValues());
    setReceiptFile(null);
    setFileError(null);
    setPreviewUrl(resolveReceiptUrl(defaultValues?.receipt) ?? null);
  }, [defaultValues, reset]);

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

  function handleFile(file: File) {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setFileError("Solo se permiten archivos JPG, PNG o PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("El archivo no debe superar 5MB");
      return;
    }
    setFileError(null);
    setReceiptFile(file);
    setPreviewUrl(file.type === "application/pdf" ? "__pdf__" : URL.createObjectURL(file));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
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
          <label className="label">Comprobante <span className="text-gray-400 font-normal">(Opcional)</span></label>
          {previewUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              {previewUrl === "__pdf__" ? (
                <svg className="w-8 h-8 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : (
                <img src={previewUrl} alt="Comprobante" className="w-10 h-10 object-cover rounded border border-gray-200" />
              )}
              <span className="text-sm text-gray-600 truncate flex-1">
                {receiptFile ? receiptFile.name : previewUrl.split("/").pop()}
              </span>
              {previewUrl !== "__pdf__" && !receiptFile && (
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
                  Ver
                </a>
              )}
              <button
                type="button"
                onClick={() => { setPreviewUrl(null); setReceiptFile(null); setFileError(null); }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => document.getElementById("receipt-pair-input")?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors
                ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
            >
              <input
                id="receipt-pair-input"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm text-gray-500 text-center">
                <span className="font-medium text-indigo-600">Selecciona</span> o arrastra tu archivo
              </p>
              <p className="text-xs text-gray-400">PDF, JPG o PNG · Máx. 5MB</p>
            </div>
          )}
          {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
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
