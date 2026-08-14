"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SearchInput from "@/components/ui/SearchInput";
import PaymentForm from "@/components/payments/PaymentForm";
import PaymentTable, { type PaymentRow } from "@/components/payments/PaymentTable";
import type { PaymentInput } from "@/lib/validations";
import { PAYMENT_METHOD_LABELS } from "@/lib/utils";
import { resolveReceiptUrl } from "@/lib/receipt";
import toast from "react-hot-toast";

interface Category { id: string; name: string; color: string; }
interface User { id: string; name: string | null; email: string; }

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterUser, setFilterUser] = useState("");

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentRow | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (search) params.set("search", search);
    if (filterCategory) params.set("categoryId", filterCategory);
    if (filterStatus) params.set("status", filterStatus);
    if (filterMethod) params.set("paymentMethod", filterMethod);
    if (filterUser) params.set("paidById", filterUser);

    const res = await fetch(`/api/payments?${params}`);
    const response = await res.json();
    setPayments(Array.isArray(response) ? response : (response?.data || []));
    setLoading(false);
  }, [search, filterCategory, filterStatus, filterMethod, filterUser]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  useEffect(() => {
    fetch("/api/categories?type=PAYMENT").then((r) => r.json()).then(setCategories);
    fetch("/api/users").then((r) => r.json()).then((d) => setUsers(Array.isArray(d) ? d : []));
  }, []);

  async function handleSubmit(data: PaymentInput, receiptFile?: File) {
    let receiptUrl = resolveReceiptUrl(editingPayment?.receipt) ?? null;

    if (receiptFile) {
      const fd = new FormData();
      fd.append("file", receiptFile);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (upData.url) receiptUrl = upData.url;
    }

    const payload = { ...data, receipt: receiptUrl };

    if (editingPayment) {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`Pago "${editingPayment.name}" actualizado`);
      } else {
        toast.error("Error al actualizar el pago");
      }
    } else {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Pago creado correctamente");
      } else {
        toast.error("Error al crear el pago");
      }
    }

    setShowForm(false);
    setEditingPayment(null);
    fetchPayments();
  }

  async function handleDelete() {
    if (!deletingPayment) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/payments/${deletingPayment.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeletingPayment(null);
    if (res.ok) {
      toast.success(`Pago "${deletingPayment.name}" eliminado`);
    } else {
      toast.error("Error al eliminar el pago");
    }
    fetchPayments();
  }

  function handleEdit(row: PaymentRow) {
    setEditingPayment(row);
    setShowForm(true);
  }

  function openNew() {
    setEditingPayment(null);
    setShowForm(true);
  }

  return (
    <div>
      <Header
        title="Pagos"
        subtitle="Registro y control de todos tus pagos"
        actions={
          <button onClick={openNew} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo pago
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-end">
          <div className="sm:col-span-2 lg:col-auto">
            <label className="label">Buscar</label>
            <SearchInput value={search} onChange={setSearch} placeholder="Folio, nombre o concepto..." />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input w-full lg:w-44" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input w-full lg:w-40" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="label">Forma de pago</label>
            <select className="input w-full lg:w-44" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Responsable</label>
            <select className="input w-full lg:w-44" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="">Todos</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
            </select>
          </div>
          <button
            onClick={() => { setSearch(""); setFilterCategory(""); setFilterStatus(""); setFilterMethod(""); setFilterUser(""); }}
            className="btn-secondary w-full sm:w-auto"
          >
            Limpiar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      ) : (
        <PaymentTable
          data={payments}
          onEdit={handleEdit}
          onDelete={setDeletingPayment}
          onViewReceipt={setReceiptPreview}
        />
      )}

      {/* Form sheet */}
      <Sheet
        open={showForm}
        onClose={() => { setShowForm(false); setEditingPayment(null); }}
        title={editingPayment ? "Editar pago" : "Nuevo pago"}
        size="lg"
      >
        <PaymentForm
          defaultValues={
            editingPayment
              ? {
                  ...editingPayment,
                  amount: Number(editingPayment.amount),
                  period: editingPayment.period as any,
                  status: editingPayment.status as any,
                  paymentMethod: editingPayment.paymentMethod as any,
                  paymentDate: editingPayment.paymentDate
                    ? new Date(editingPayment.paymentDate).toISOString().split("T")[0]
                    : "",
                  dueDate: editingPayment.dueDate
                    ? new Date(editingPayment.dueDate).toISOString().split("T")[0]
                    : "",
                }
              : undefined
          }
          categories={categories}
          users={users}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingPayment(null); }}
          isEdit={!!editingPayment}
        />
      </Sheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDelete}
        title="Eliminar pago"
        message={`¿Estás seguro de eliminar el pago "${deletingPayment?.name}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
      />

      {/* Receipt preview */}
      <Sheet
        open={!!receiptPreview}
        onClose={() => setReceiptPreview(null)}
        title="Vista previa del comprobante"
        size="md"
      >
        {receiptPreview && (
          <div className="p-4 flex justify-center">
            {receiptPreview.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={receiptPreview}
                className="w-full h-[80vh] rounded-lg border"
                title="Comprobante PDF"
              />
            ) : (
              <img
                src={receiptPreview}
                alt="Comprobante"
                className="max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
