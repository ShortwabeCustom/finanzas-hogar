"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLimpiarCampos } from "@/hooks/useLimpiarCampos";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchInput from "@/components/ui/SearchInput";
import {
  pantryItemSchema,
  productPurchaseSchema,
  type PantryItemInput,
  type ProductPurchaseInput,
} from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import type { ProductMetrics } from "@/lib/productMetrics";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string; color: string; }

interface PurchaseHistory {
  id: string;
  purchaseDate: string;
  previousPurchaseDate: string | null;
  daysElapsed: number | null;
  price: number | null;
  notes: string | null;
}

interface PantryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minStock: number;
  price: number | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  comments: string | null;
  category: Category;
  addedBy: { name: string | null } | null;
  purchaseHistory: PurchaseHistory[];
  metrics: ProductMetrics;
}

// ─── Repurchase helpers ────────────────────────────────────────────────────────

function RepurchaseBadge({ metrics }: { metrics: ProductMetrics }) {
  if (metrics.status === "no_purchases" || metrics.status === "no_history") {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  if (metrics.status === "on_time") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
        A tiempo
      </span>
    );
  }
  if (metrics.status === "soon") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
        Próxima
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
      Atrasado
    </span>
  );
}

function NextRepurchaseCell({ metrics }: { metrics: ProductMetrics }) {
  if (metrics.status === "no_purchases") {
    return <span className="text-gray-400 text-xs">—</span>;
  }
  if (metrics.status === "no_history") {
    return <span className="text-gray-400 text-xs">Sin histórico</span>;
  }
  if (!metrics.nextPurchaseDate || metrics.daysUntilNext === null) {
    return <span className="text-gray-400 text-xs">No calculable</span>;
  }

  const d = metrics.daysUntilNext;
  const relStr =
    d === 0 ? "Hoy"
    : d > 0 ? `en ${d} día${d === 1 ? "" : "s"}`
    : `hace ${Math.abs(d)} día${Math.abs(d) === 1 ? "" : "s"}`;

  return (
    <div>
      <div className="text-xs text-gray-700">
        {(() => {
          const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
          const [y, m, d] = metrics.nextPurchaseDate!.slice(0, 10).split("-").map(Number);
          return `${String(d).padStart(2,"0")} ${months[m - 1]} ${y}`;
        })()}
      </div>
      <div className="text-xs text-gray-400">{relStr}</div>
    </div>
  );
}

// ─── AlertBadge (existing) ────────────────────────────────────────────────────

function AlertBadge({ item }: { item: PantryItem }) {
  const lowStock = Number(item.quantity) <= Number(item.minStock);
  if (lowStock) return <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800">Stock bajo</span>;
  return <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">OK</span>;
}

const EMPTY_PANTRY_ITEM_VALUES = {
  name: "", categoryId: "", price: undefined as any, purchaseDate: "", comments: "",
};

// ─── PantryForm (existing) ────────────────────────────────────────────────────

function PantryForm({
  defaultValues, categories, onSubmit, onCancel, isEdit,
}: {
  defaultValues?: Partial<PantryItemInput & { id: string }>;
  categories: Category[];
  onSubmit: (data: PantryItemInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PantryItemInput>({
    resolver: zodResolver(pantryItemSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      price: defaultValues?.price ?? undefined,
      purchaseDate: defaultValues?.purchaseDate ?? "",
      comments: defaultValues?.comments ?? "",
    },
  });

  const limpiarCampos = useLimpiarCampos(reset, EMPTY_PANTRY_ITEM_VALUES);

  useEffect(() => {
    reset({
      name: defaultValues?.name ?? "",
      categoryId: defaultValues?.categoryId ?? "",
      price: defaultValues?.price ?? undefined,
      purchaseDate: defaultValues?.purchaseDate ?? "",
      comments: defaultValues?.comments ?? "",
    });
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-full">
          <label className="label">Producto *</label>
          <input className="input" placeholder="Ej: Arroz" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Categoría *</label>
          <select className="input" {...register("categoryId")}>
            <option value="">Selecciona...</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.categoryId && <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>}
        </div>
        <div>
          <label className="label">Precio</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input pl-7"
              placeholder="0.00"
              {...register("price", { valueAsNumber: true })}
            />
          </div>
          {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message}</p>}
        </div>
        <div className="col-span-full">
          <label className="label">Fecha de compra</label>
          <input type="date" className="input" {...register("purchaseDate")} />
        </div>
        <div className="col-span-full">
          <label className="label">Comentarios</label>
          <textarea className="input resize-none" rows={2} {...register("comments")} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary w-full sm:w-auto" disabled={isSubmitting}>Cancelar</button>
        <button type="button" onClick={limpiarCampos} className="btn-secondary w-full sm:w-auto" disabled={isSubmitting}>Limpiar campos</button>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Agregar producto"}
        </button>
      </div>
    </form>
  );
}

// ─── PurchaseForm ─────────────────────────────────────────────────────────────

function PurchaseForm({
  itemName,
  currentPrice,
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = "Registrar compra",
  description,
}: {
  itemName: string;
  currentPrice: number | null;
  onSubmit: (data: ProductPurchaseInput) => Promise<void>;
  onCancel: () => void;
  initialValues?: Partial<ProductPurchaseInput>;
  submitLabel?: string;
  description?: React.ReactNode;
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProductPurchaseInput>({
    resolver: zodResolver(productPurchaseSchema) as any,
    defaultValues: {
      purchaseDate: initialValues?.purchaseDate ?? todayStr,
      price: initialValues?.price ?? currentPrice ?? undefined,
      notes: initialValues?.notes ?? "",
    },
  });

  const limpiarCampos = useLimpiarCampos(reset, {
    purchaseDate: todayStr,
    price: currentPrice ?? undefined,
    notes: "",
  });

  useEffect(() => {
    reset({
      purchaseDate: initialValues?.purchaseDate ?? todayStr,
      price: initialValues?.price ?? currentPrice ?? undefined,
      notes: initialValues?.notes ?? "",
    });
  }, [initialValues, currentPrice, todayStr, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <p className="text-sm text-gray-500">
        {description ?? <>Registrando compra para <span className="font-medium text-gray-800">{itemName}</span></>}
      </p>
      <div className="space-y-4">
        <div>
          <label className="label">Fecha de compra *</label>
          <input type="date" className="input" {...register("purchaseDate")} />
          {errors.purchaseDate && <p className="mt-1 text-xs text-red-600">{errors.purchaseDate.message}</p>}
        </div>
        <div>
          <label className="label">Precio</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input pl-7"
              placeholder="0.00"
              {...register("price", { valueAsNumber: true })}
            />
          </div>
          {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price.message as string}</p>}
        </div>
        <div>
          <label className="label">Notas</label>
          <textarea className="input resize-none" rows={2} placeholder="Opcional..." {...register("notes")} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary w-full sm:w-auto">Cancelar</button>
        <button type="button" onClick={limpiarCampos} className="btn-secondary w-full sm:w-auto" disabled={isSubmitting}>Limpiar campos</button>
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

// ─── HistoryModal ─────────────────────────────────────────────────────────────

function HistoryModal({ item, onClose, onRefresh }: { item: PantryItem; onClose: () => void; onRefresh: () => Promise<void> }) {
  const m = item.metrics;
  const [editingPurchase, setEditingPurchase] = useState<PurchaseHistory | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<PurchaseHistory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editError, setEditError] = useState("");

  function fmtDate(iso: string | null) {
    if (!iso) return "—";
    // Leer los componentes UTC directamente del string para evitar desplazamiento por zona horaria
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const [y, mo, d] = iso.slice(0, 10).split("-").map(Number);
    return `${String(d).padStart(2,"0")} ${months[mo - 1]} ${y}`;
  }

  function daysUntilLabel(d: number | null) {
    if (d === null) return "—";
    if (d === 0) return "Hoy";
    if (d > 0) return `en ${d} día${d === 1 ? "" : "s"}`;
    return `hace ${Math.abs(d)} día${Math.abs(d) === 1 ? "" : "s"}`;
  }

  async function handleEditSave(data: ProductPurchaseInput) {
    if (!editingPurchase) return;
    setEditError("");
    const res = await fetch(`/api/pantry/${item.id}/purchases/${editingPurchase.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(typeof body.error === "string" ? body.error : "Error al guardar");
      return;
    }
    setEditingPurchase(null);
    await onRefresh();
  }

  async function handleDeleteConfirm() {
    if (!deletingPurchase) return;
    setDeleteLoading(true);
    await fetch(`/api/pantry/${item.id}/purchases/${deletingPurchase.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeletingPurchase(null);
    await onRefresh();
  }

  return (
    <>
      <div className={editingPurchase ? "flex h-full divide-x divide-gray-200" : undefined}>
        {/* Edit panel - left side, visible when editing */}
        {editingPurchase && (
          <div className="w-64 shrink-0 flex flex-col overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-gray-700">Editar compra</h3>
              <button
                onClick={() => setEditingPurchase(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {editError && (
              <p className="mx-4 mt-3 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
            )}
            <div className="flex-1 overflow-y-auto">
              <PurchaseForm
                itemName={item.name}
                currentPrice={editingPurchase.price}
                initialValues={{
                  purchaseDate: editingPurchase.purchaseDate.slice(0, 10),
                  price: editingPurchase.price ?? undefined,
                  notes: editingPurchase.notes ?? "",
                }}
                submitLabel="Guardar cambios"
                description={<>Editando compra del <span className="font-medium text-gray-800">{fmtDate(editingPurchase.purchaseDate)}</span></>}
                onSubmit={handleEditSave}
                onCancel={() => setEditingPurchase(null)}
              />
            </div>
          </div>
        )}

        {/* Main history content */}
        <div className={editingPurchase ? "flex-1 overflow-y-auto p-6 space-y-4 min-w-0" : "p-6 space-y-4"}>
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Total compras registradas</p>
              <p className="text-lg font-bold text-gray-900">{m.purchaseCount}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Últ. reposición</p>
              <p className="text-lg font-bold text-gray-900">
                {m.lastDaysElapsed !== null ? `${m.lastDaysElapsed} días` : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Promedio de duración</p>
              <p className="text-lg font-bold text-gray-900">
                {m.avgDaysElapsed !== null ? `${m.avgDaysElapsed} días` : "—"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Próxima recompra</p>
              <p className="text-base font-bold text-gray-900">
                {m.nextPurchaseDate ? fmtDate(m.nextPurchaseDate) : "—"}
              </p>
              {m.daysUntilNext !== null && (
                <p className="text-xs text-gray-500">{daysUntilLabel(m.daysUntilNext)}</p>
              )}
            </div>
          </div>

          {/* History table */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial cronológico</h3>
            {item.purchaseHistory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No hay compras registradas aún</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">#</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Fecha compra</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Precio</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Compra anterior</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Días transcurridos</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Notas</th>
                      <th className="px-2 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {item.purchaseHistory.map((h, idx) => (
                      <tr key={h.id} className={`group hover:bg-gray-50 ${editingPurchase?.id === h.id ? "bg-blue-50" : ""}`}>
                        <td className="px-3 py-2 text-gray-400">{item.purchaseHistory.length - idx}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{fmtDate(h.purchaseDate)}</td>
                        <td className="px-3 py-2 text-gray-700 whitespace-nowrap">
                          {h.price != null
                            ? `$${Number(h.price).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {h.previousPurchaseDate
                            ? fmtDate(h.previousPurchaseDate)
                            : <em className="text-gray-400">Primera compra</em>}
                        </td>
                        <td className="px-3 py-2">
                          {h.daysElapsed !== null ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                              {h.daysElapsed} día{h.daysElapsed !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500 max-w-[100px] truncate">
                          {h.notes || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditError(""); setEditingPurchase(h); }}
                              title="Editar"
                              className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingPurchase(h)}
                              title="Eliminar"
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
          </div>
        </div>
      </div>

      {/* Delete purchase confirm */}
      <ConfirmDialog
        open={!!deletingPurchase}
        onClose={() => setDeletingPurchase(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar compra"
        message={deletingPurchase ? `¿Eliminar la compra del ${fmtDate(deletingPurchase.purchaseDate)}?` : ""}
        loading={deleteLoading}
      />
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterAlert, setFilterAlert] = useState("");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PantryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<PantryItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<PantryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [formError, setFormError] = useState("");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterAlert) params.set("alert", filterAlert);
    const res = await fetch(`/api/pantry?${params}`);
    const data: PantryItem[] = await res.json();
    const list = Array.isArray(data) ? data : [];
    setItems(list);
    setLoading(false);
    return list;
  }, [search, filterCategory, filterAlert]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => {
    fetch("/api/categories?type=PANTRY").then((r) => r.json()).then(setCategories);
  }, []);

  async function handleSubmit(data: PantryItemInput) {
    setFormError("");
    const res = editingItem
      ? await fetch(`/api/pantry/${editingItem.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        })
      : await fetch("/api/pantry", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
        });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = typeof body.error === "string"
        ? body.error
        : (body.error ? JSON.stringify(body.error) : `HTTP ${res.status}`);
      setFormError(msg);
      return;
    }
    setShowForm(false);
    setEditingItem(null);
    await fetchItems();
  }

  async function handleDelete() {
    if (!deletingItem) return;
    setDeleteLoading(true);
    await fetch(`/api/pantry/${deletingItem.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeletingItem(null);
    fetchItems();
  }

  async function handleSavePurchase(data: ProductPurchaseInput) {
    if (!selectedItem) return;
    setPurchaseError("");
    const res = await fetch(`/api/pantry/${selectedItem.id}/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      setPurchaseError(typeof body.error === "string" ? body.error : "Error al registrar");
      return;
    }
    setShowPurchaseModal(false);
    setSelectedItem(null);
    fetchItems();
  }

  const lowStockCount = items.filter((i) => Number(i.quantity) <= Number(i.minStock)).length;

  return (
    <div>
      <Header
        title="Despensa"
        subtitle="Control de inventario, caducidades y recompras"
        actions={
          <button onClick={() => { setEditingItem(null); setFormError(""); setShowForm(true); }} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Agregar producto
          </button>
        }
      />

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg"><svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg></div>
          <div><p className="text-xs text-gray-500">Stock bajo</p><p className="text-xl font-bold text-gray-900">{lowStockCount}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg"><svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div><p className="text-xs text-gray-500">A tiempo</p><p className="text-xl font-bold text-gray-900">{items.filter(i => i.metrics.status === "on_time").length}</p></div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg"><svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
          <div><p className="text-xs text-gray-500">Recompra atrasada</p><p className="text-xl font-bold text-gray-900">{items.filter(i => i.metrics.status === "overdue").length}</p></div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="label">Buscar</label><SearchInput value={search} onChange={setSearch} placeholder="Nombre de producto..." /></div>
          <div>
            <label className="label">Categoría</label>
            <select className="input w-44" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Alertas</label>
            <select className="input w-44" value={filterAlert} onChange={(e) => setFilterAlert(e.target.value)}>
              <option value="">Todas</option>
              <option value="low">Stock bajo</option>
            </select>
          </div>
          <button onClick={() => { setSearch(""); setFilterCategory(""); setFilterAlert(""); }} className="btn-secondary">Limpiar</button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Producto", "Categoría", "Precio", "Estado", "Última compra", "Últ. reposición", "Prom. duración", "Próxima recompra estimada", "Acciones"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">No hay productos en la despensa</td></tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.category?.color }} />
                          <span className="text-gray-600">{item.category?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {item.price != null
                          ? `$${Number(item.price).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : <span className="text-gray-400">—</span>}
                      </td>
                      {/* activo chip */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Activo
                        </span>
                      </td>
                      {/* Última compra desde historial (fallback a purchaseDate del item) */}
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {item.metrics.lastPurchaseDate
                          ? formatDate(item.metrics.lastPurchaseDate)
                          : formatDate(item.purchaseDate)}
                      </td>
                      {/* Duración última reposición */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.metrics.lastDaysElapsed !== null
                          ? <span className="text-gray-700">{item.metrics.lastDaysElapsed} día{item.metrics.lastDaysElapsed !== 1 ? "s" : ""}</span>
                          : <span className="text-gray-400 text-xs">Sin histórico</span>}
                      </td>
                      {/* Promedio duración */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {item.metrics.avgDaysElapsed !== null
                          ? <span className="text-gray-700">{item.metrics.avgDaysElapsed} día{item.metrics.avgDaysElapsed !== 1 ? "s" : ""}</span>
                          : <span className="text-gray-400 text-xs">
                              {item.metrics.status === "no_purchases" ? "—" : "Sin histórico"}
                            </span>}
                      </td>
                      {/* Próxima recompra estimada: fecha + días + badge */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <NextRepurchaseCell metrics={item.metrics} />
                          <RepurchaseBadge metrics={item.metrics} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Register purchase */}
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setPurchaseError("");
                              setShowPurchaseModal(true);
                            }}
                            title="Registrar compra"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </button>
                          {/* View history */}
                          <button
                            onClick={() => { setSelectedItem(item); setShowHistoryModal(true); }}
                            title="Ver historial de compras"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => { setEditingItem(item); setFormError(""); setShowForm(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit product sheet */}
      <Sheet open={showForm} onClose={() => { setShowForm(false); setEditingItem(null); setFormError(""); }} title={editingItem ? "Editar producto" : "Agregar producto"} size="md">
        {formError && (
          <p className="mx-6 mt-4 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
        )}
        <PantryForm
          defaultValues={editingItem ? {
            name: editingItem.name,
            categoryId: editingItem.category?.id,
            price: editingItem.price != null ? Number(editingItem.price) : undefined,
            purchaseDate: editingItem.purchaseDate ? new Date(editingItem.purchaseDate).toISOString().split("T")[0] : "",
            comments: editingItem.comments ?? "",
          } : undefined}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingItem(null); setFormError(""); }}
          isEdit={!!editingItem}
        />
      </Sheet>

      {/* Register purchase sheet */}
      <Sheet
        open={showPurchaseModal}
        onClose={() => { setShowPurchaseModal(false); setSelectedItem(null); }}
        title="Registrar compra"
        size="md"
      >
        {purchaseError && (
          <p className="mx-6 mt-4 text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{purchaseError}</p>
        )}
        {selectedItem && (
          <PurchaseForm
            itemName={selectedItem.name}
            currentPrice={selectedItem.price}
            onSubmit={handleSavePurchase}
            onCancel={() => { setShowPurchaseModal(false); setSelectedItem(null); }}
          />
        )}
      </Sheet>

      {/* History sheet */}
      <Sheet
        open={showHistoryModal}
        onClose={() => { setShowHistoryModal(false); setSelectedItem(null); }}
        title={selectedItem ? `Historial — ${selectedItem.name}` : "Historial"}
        size="2xl"
      >
        {selectedItem && (
          <HistoryModal
            item={selectedItem}
            onClose={() => { setShowHistoryModal(false); setSelectedItem(null); }}
            onRefresh={async () => {
              const list = await fetchItems();
              const updated = list.find((i) => i.id === selectedItem.id);
              if (updated) setSelectedItem(updated);
            }}
          />
        )}
      </Sheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        title="Eliminar producto"
        message={`¿Eliminar "${deletingItem?.name}" de la despensa?`}
        loading={deleteLoading}
      />
    </div>
  );
}
