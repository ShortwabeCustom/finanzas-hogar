"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLimpiarCampos } from "@/hooks/useLimpiarCampos";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusBadge from "@/components/ui/StatusBadge";
import { personalPaymentSchema, type PersonalPaymentInput } from "@/lib/validations";
import {
  formatCurrency, formatDate,
  PERIOD_LABELS, STATUS_LABELS, PAYMENT_METHOD_LABELS,
} from "@/lib/utils";

interface PersonalCategory { id: string; name: string; color: string; }
interface PersonalCard {
  id: string;
  bankName: string;
  cardName: string;
  last4Digits: string;
  closingDay: number;
  dueDay: number;
  active: boolean;
}
interface PersonalPayment {
  id: string;
  folio: string;
  name: string;
  concept: string;
  amount: number | string;
  categoryId: string;
  category: PersonalCategory;
  personalCardId: string | null;
  card: PersonalCard | null;
  period: string;
  status: string;
  paymentMethod: string;
  dueDate: string | null;
  paymentDate: string | null;
  notes: string | null;
  receipt: string | null;
  createdAt: string;
}

const EMPTY_PERSONAL_PAYMENT_VALUES = {
  name: "", concept: "", categoryId: "", amount: "" as any,
  period: "MONTHLY" as const, status: "PENDING" as const,
  paymentMethod: "TRANSFER" as const, personalCardId: "",
  dueDate: "", paymentDate: "", notes: "", receipt: "",
};

const PERIODS = ["ONCE","WEEKLY","BIWEEKLY","MONTHLY","BIMONTHLY","QUARTERLY","SEMIANNUAL","ANNUAL"] as const;
const STATUSES = ["PENDING","PAID","OVERDUE","CANCELLED"] as const;
const METHODS = ["CASH","CREDIT_CARD","DEBIT_CARD","TRANSFER","CHECK","OTHER"] as const;
const CARD_METHODS = ["CREDIT_CARD","DEBIT_CARD","TRANSFER"];

function PaymentForm({
  defaultValues,
  categories,
  cards,
  onSubmit,
  onCancel,
  isEdit,
}: {
  defaultValues?: Partial<PersonalPaymentInput & { id: string; receipt?: string | null }>;
  categories: PersonalCategory[];
  cards: PersonalCard[];
  onSubmit: (data: PersonalPaymentInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonalPaymentInput>({
    resolver: zodResolver(personalPaymentSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      concept: defaultValues?.concept ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      amount: defaultValues?.amount as any ?? "",
      period: (defaultValues?.period ?? "MONTHLY") as any,
      status: (defaultValues?.status ?? "PENDING") as any,
      paymentMethod: (defaultValues?.paymentMethod ?? "TRANSFER") as any,
      personalCardId: defaultValues?.personalCardId ?? "",
      dueDate: defaultValues?.dueDate ? defaultValues.dueDate.slice(0, 10) : "",
      paymentDate: defaultValues?.paymentDate ? defaultValues.paymentDate.slice(0, 10) : "",
      notes: defaultValues?.notes ?? "",
      receipt: defaultValues?.receipt ?? "",
    },
  });

  const paymentMethod = useWatch({ control, name: "paymentMethod" });
  const showCardField = CARD_METHODS.includes(paymentMethod);
  const activeCards = cards.filter((c) => c.active);

  const [receiptUrl, setReceiptUrl] = useState<string>(defaultValues?.receipt ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const limpiarCampos = useLimpiarCampos(reset, EMPTY_PERSONAL_PAYMENT_VALUES, [
    () => setReceiptUrl(""),
    () => setUploadError(null),
    () => setDragOver(false),
  ]);

  useEffect(() => {
    reset({
      name: defaultValues?.name ?? "",
      concept: defaultValues?.concept ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      amount: (defaultValues?.amount as any) ?? "",
      period: (defaultValues?.period ?? "MONTHLY") as any,
      status: (defaultValues?.status ?? "PENDING") as any,
      paymentMethod: (defaultValues?.paymentMethod ?? "TRANSFER") as any,
      personalCardId: defaultValues?.personalCardId ?? "",
      dueDate: defaultValues?.dueDate ? defaultValues.dueDate.slice(0, 10) : "",
      paymentDate: defaultValues?.paymentDate ? defaultValues.paymentDate.slice(0, 10) : "",
      notes: defaultValues?.notes ?? "",
      receipt: defaultValues?.receipt ?? "",
    });
    setReceiptUrl(defaultValues?.receipt ?? "");
    setUploadError(null);
  }, [defaultValues, reset]);

  const handleFile = useCallback(async (file: File) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setUploadError("Solo se permiten archivos JPG, PNG o PDF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("El archivo no debe superar 5MB");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Error al subir");
      setReceiptUrl(json.url);
      setValue("receipt", json.url);
    } catch (e: any) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }, [setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-full">
          <label className="label">Nombre *</label>
          <input className="input" placeholder="Ej: Netflix, Gym..." {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="col-span-full">
          <label className="label">Concepto *</label>
          <input className="input" placeholder="Descripción del pago..." {...register("concept")} />
          {errors.concept && <p className="mt-1 text-xs text-red-600">{errors.concept.message}</p>}
        </div>
        <div>
          <label className="label">Monto *</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0.00" {...register("amount")} />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
        </div>
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
        <div>
          <label className="label">Período</label>
          <select className="input" {...register("period")}>
            {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input" {...register("status")}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Forma de pago</label>
          <select className="input" {...register("paymentMethod")}>
            {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>

        {/* Dynamic card selector — only for CREDIT_CARD, DEBIT_CARD, TRANSFER */}
        {showCardField && (
          <div className="col-span-full">
            <label className="label">Tarjeta asociada</label>
            {activeCards.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-700 flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Primero registra una tarjeta en{" "}
                  <Link href="/personal/cards" className="font-semibold underline">Mis Tarjetas</Link>{" "}
                  para poder asociarla a este pago.
                </span>
              </div>
            ) : (
              <select className="input" {...register("personalCardId")}>
                <option value="">Sin tarjeta específica</option>
                {activeCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.bankName} — {c.cardName} •••• {c.last4Digits}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="col-span-full">
          <label className="label">Fecha de vencimiento</label>
          <input className="input" type="date" {...register("dueDate")} />
        </div>
        <div className="col-span-full">
          <label className="label">Fecha de pago</label>
          <input className="input" type="date" {...register("paymentDate")} />
        </div>
        {/* Comprobante upload */}
        <div className="col-span-full">
          <label className="label">Comprobante <span className="text-gray-400 font-normal">(Opcional)</span></label>
          {receiptUrl ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
              {receiptUrl.endsWith(".pdf") ? (
                <svg className="w-8 h-8 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              ) : (
                <img src={receiptUrl} alt="Comprobante" className="w-10 h-10 object-cover rounded border border-gray-200" />
              )}
              <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:underline truncate flex-1">
                {receiptUrl.split("/").pop()}
              </a>
              <button
                type="button"
                onClick={() => { setReceiptUrl(""); setValue("receipt", ""); }}
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
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 transition-colors cursor-pointer
                ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
              onClick={() => document.getElementById("receipt-input")?.click()}
            >
              <input
                id="receipt-input"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              {uploading ? (
                <svg className="w-6 h-6 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              <p className="text-sm text-gray-500 text-center">
                {uploading ? "Subiendo..." : <><span className="font-medium text-indigo-600">Selecciona</span> o arrastra tu archivo</>}
              </p>
              <p className="text-xs text-gray-400">PDF, JPG o PNG · Máx. 5MB</p>
            </div>
          )}
          {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
          <input type="hidden" {...register("receipt")} />
        </div>

        <div className="col-span-full">
          <label className="label">Notas</label>
          <textarea className="input" rows={2} placeholder="Notas opcionales..." {...register("notes")} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary w-full sm:w-auto">Cancelar</button>
        <button type="button" onClick={limpiarCampos} className="btn-secondary w-full sm:w-auto" disabled={isSubmitting}>Limpiar campos</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full sm:w-auto">
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Crear pago"}
        </button>
      </div>
    </form>
  );
}

export default function PersonalPaymentsPage() {
  const [payments, setPayments] = useState<PersonalPayment[]>([]);
  const [categories, setCategories] = useState<PersonalCategory[]>([]);
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PersonalPayment | null>(null);
  const [deleting, setDeleting] = useState<PersonalPayment | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterStatus) params.set("status", filterStatus);
    if (filterMethod) params.set("paymentMethod", filterMethod);
    const res = await fetch(`/api/personal/payments?${params}`);
    const data = await res.json();
    setPayments(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [search, filterCategory, filterStatus, filterMethod]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    fetch("/api/personal/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : []));
    fetch("/api/personal/cards").then((r) => r.json()).then((d) => setCards(Array.isArray(d) ? d : []));
  }, []);

  async function handleSubmit(data: PersonalPaymentInput) {
    setError(null);
    const url = editing ? `/api/personal/payments/${editing.id}` : "/api/personal/payments";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Error al guardar");
      return;
    }

    setShowForm(false);
    setEditing(null);
    fetchPayments();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    await fetch(`/api/personal/payments/${deleting.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeleting(null);
    fetchPayments();
  }

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <div>
      <Header
        title="Mis Pagos"
        subtitle="Gestiona exclusivamente tus pagos personales"
        actions={
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
            + Nuevo pago
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button className="font-medium underline ml-2" onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="Buscar por nombre, folio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select className="input" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
            <option value="">Todas las formas</option>
            {METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-500 font-medium">Sin pagos personales</p>
            <p className="text-gray-400 text-sm mt-1">
              {search || filterCategory || filterStatus || filterMethod
                ? "No hay resultados con los filtros actuales"
                : "Crea tu primer pago personal"}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-100">
              {payments.map((p) => (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{p.concept}</p>
                    </div>
                    <span className="font-semibold text-gray-900 text-sm flex-shrink-0">{formatCurrency(p.amount)}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.category?.color }} />
                      <span className="text-xs text-gray-500">{p.category?.name}</span>
                    </div>
                    <StatusBadge status={p.status} />
                    {p.dueDate && (
                      <span className="text-xs text-gray-400">Vence: {formatDate(p.dueDate)}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-indigo-600">{p.folio}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditing(p); setShowForm(true); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleting(p)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{payments.length} pago{payments.length !== 1 ? "s" : ""}</span>
                <span className="font-bold text-gray-900 text-sm">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3">Folio</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Monto</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Forma / Tarjeta</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-indigo-700 whitespace-nowrap">{p.folio}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400 truncate max-w-[160px]">{p.concept}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.category?.color }} />
                          <span className="text-gray-600 whitespace-nowrap">{p.category?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3">
                        <p className="text-gray-600 whitespace-nowrap">{PAYMENT_METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}</p>
                        {p.card && (
                          <p className="text-xs text-indigo-600 font-mono mt-0.5">
                            {p.card.bankName} •••• {p.card.last4Digits}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(p.dueDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditing(p); setShowForm(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleting(p)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {payments.length} pago{payments.length !== 1 ? "s" : ""}
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(total)}</td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      <Sheet
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); setError(null); }}
        title={editing ? "Editar pago personal" : "Nuevo pago personal"}
        size="md"
      >
        <PaymentForm
          defaultValues={editing ? { ...editing, amount: Number(editing.amount), personalCardId: editing.personalCardId ?? "" } as any : undefined}
          categories={categories}
          cards={cards}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(null); setError(null); }}
          isEdit={!!editing}
        />
      </Sheet>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminar pago"
        message={`¿Eliminar el pago "${deleting?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}
