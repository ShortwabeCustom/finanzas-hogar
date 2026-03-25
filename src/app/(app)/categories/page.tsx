"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/layout/Header";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { categorySchema, type CategoryInput } from "@/lib/validations";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#64748b",
];

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Solo pagos",
  PANTRY: "Solo despensa",
  BOTH: "Ambos",
};

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  type: string;
  active: boolean;
  _count?: { payments: number; pantryItems: number };
}

function CategoryForm({
  defaultValues, onSubmit, onCancel, isEdit,
}: {
  defaultValues?: Partial<CategoryInput & { id: string }>;
  onSubmit: (data: CategoryInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      color: defaultValues?.color ?? "#6366f1",
      icon: defaultValues?.icon ?? "",
      type: defaultValues?.type ?? "BOTH",
    },
  });

  const selectedColor = watch("color");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" placeholder="Ej: Servicios" {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label className="label">Descripción</label>
        <input className="input" placeholder="Descripción opcional..." {...register("description")} />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select className="input" {...register("type")}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex items-center gap-3 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setValue("color", c)}
              className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: selectedColor === c ? "#111" : "transparent",
              }}
            />
          ))}
          <input
            type="color"
            className="w-8 h-8 rounded-full cursor-pointer border border-gray-300"
            {...register("color")}
          />
        </div>
        {errors.color && <p className="mt-1 text-xs text-red-600">{errors.color.message}</p>}
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deletingCat, setDeletingCat] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/categories");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  async function handleSubmit(data: CategoryInput) {
    if (editingCat) {
      await fetch(`/api/categories/${editingCat.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/categories", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
    }
    setShowForm(false);
    setEditingCat(null);
    fetchCategories();
  }

  async function handleDelete() {
    if (!deletingCat) return;
    setDeleteLoading(true);
    await fetch(`/api/categories/${deletingCat.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    setDeletingCat(null);
    fetchCategories();
  }

  return (
    <div>
      <Header
        title="Categorías"
        subtitle="Gestiona las categorías de pagos y despensa"
        actions={
          <button onClick={() => { setEditingCat(null); setShowForm(true); }} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nueva categoría
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-5 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: cat.color + "20" }}>
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: cat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">{cat.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0">
                    {TYPE_LABELS[cat.type]}
                  </span>
                </div>
                {cat.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{cat.description}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => { setEditingCat(cat); setShowForm(true); }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setDeletingCat(cat)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Desactivar
                  </button>
                </div>
              </div>
            </div>
          ))}

          {categories.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p>No hay categorías. ¡Crea la primera!</p>
            </div>
          )}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditingCat(null); }} title={editingCat ? "Editar categoría" : "Nueva categoría"} size="md">
        <CategoryForm
          defaultValues={editingCat ? { ...editingCat, type: editingCat.type as any } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingCat(null); }}
          isEdit={!!editingCat}
        />
      </Modal>

      <ConfirmDialog
        open={!!deletingCat}
        onClose={() => setDeletingCat(null)}
        onConfirm={handleDelete}
        title="Desactivar categoría"
        message={`¿Desactivar la categoría "${deletingCat?.name}"? Los registros existentes no se verán afectados.`}
        confirmLabel="Desactivar"
        loading={deleteLoading}
      />
    </div>
  );
}
