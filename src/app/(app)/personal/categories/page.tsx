"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { personalCategorySchema, type PersonalCategoryInput } from "@/lib/validations";

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b",
  "#10b981", "#14b8a6", "#06b6d4", "#3b82f6", "#64748b",
];

const TYPE_LABELS: Record<string, string> = {
  PAYMENT: "Solo pagos",
  PANTRY: "Solo despensa",
  BOTH: "Ambos",
};

interface PersonalCategory {
  id: string;
  name: string;
  description: string | null;
  color: string;
  type: string;
  active: boolean;
  _count: { payments: number };
}

function CategoryIcon({ name }: { name: string }) {
  const n = String(name || "").toLowerCase();

  if (n.includes("ahorro") || n.includes("invers")) {
    return (
      <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.12-4 2.5s1.79 2.5 4 2.5 4 1.12 4 2.5-1.79 2.5-4 2.5m0-10V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (n.includes("aliment") || n.includes("despensa") || n.includes("comida") || n.includes("restaurante")) {
    return (
      <svg className="w-5 h-5 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3v7M5 3v7M9 3v7M5 10h4M7 10v11M15 3c1.657 0 3 1.343 3 3v4h-6V6c0-1.657 1.343-3 3-3zM15 10v11" />
      </svg>
    );
  }
  if (n.includes("educ")) {
    return (
      <svg className="w-5 h-5 text-sky-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l7-3.889V16L12 20l-7-4v-5.889L12 14z" />
      </svg>
    );
  }
  if (n.includes("entreten")) {
    return (
      <svg className="w-5 h-5 text-pink-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-4.586-2.65A1 1 0 008.667 9.4v5.2a1 1 0 001.499.868l4.586-2.65a1 1 0 000-1.732z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (n.includes("hogar")) {
    return (
      <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11l9-7 9 7M5 10v10h14V10" />
      </svg>
    );
  }
  if (n.includes("ingres")) {
    return (
      <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7m0 0H9m8 0v8" />
      </svg>
    );
  }
  if (n.includes("deuda")) {
    return (
      <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364M5.636 5.636l12.728 12.728" />
      </svg>
    );
  }
  if (n.includes("salud")) {
    return (
      <svg className="w-5 h-5 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s-7-4.35-7-10a4 4 0 017-2.646A4 4 0 0119 11c0 5.65-7 10-7 10z" />
      </svg>
    );
  }
  if (n.includes("servicio") || n.includes("internet") || n.includes("luz") || n.includes("agua")) {
    return (
      <svg className="w-5 h-5 text-violet-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9a4 4 0 015.656 0M6.343 6.172a8 8 0 0111.314 0M3.515 3.343a12 12 0 0116.97 0M12 20h.01" />
      </svg>
    );
  }
  if (n.includes("suscrip")) {
    return (
      <svg className="w-5 h-5 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16v10H4zM9 7V5h6v2" />
      </svg>
    );
  }
  if (n.includes("transporte") || n.includes("gasolina")) {
    return (
      <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l2-6h14l2 6M5 13h14v5H5zM7 18h.01M17 18h.01" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2m10-10h-2M4 12H2m16.95 6.95l-1.414-1.414M6.464 6.464L5.05 5.05m13.9 0l-1.414 1.414M6.464 17.536L5.05 18.95" />
    </svg>
  );
}

function CategoryForm({
  defaultValues,
  onSubmit,
  onCancel,
  isEdit,
}: {
  defaultValues?: Partial<PersonalCategoryInput & { id: string }>;
  onSubmit: (data: PersonalCategoryInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PersonalCategoryInput>({
    resolver: zodResolver(personalCategorySchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      color: defaultValues?.color ?? "#6366f1",
      type: (defaultValues?.type ?? "PAYMENT") as any,
      active: defaultValues?.active ?? true,
    },
  });

  const selectedColor = watch("color");

  useEffect(() => {
    reset({
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      color: defaultValues?.color ?? "#6366f1",
      type: (defaultValues?.type ?? "PAYMENT") as any,
      active: defaultValues?.active ?? true,
    });
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" placeholder="Ej: Celular, Gym..." {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label className="label">Descripción</label>
        <input className="input" placeholder="Descripción opcional..." {...register("description")} />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select className="input" {...register("type")}>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
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
                borderColor: selectedColor === c ? "#1e1b4b" : "transparent",
              }}
            />
          ))}
          <input
            type="color"
            value={selectedColor}
            onChange={(e) => setValue("color", e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer border-0"
            title="Color personalizado"
          />
        </div>
        {errors.color && <p className="mt-1 text-xs text-red-600">{errors.color.message}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}

export default function PersonalCategoriesPage() {
  const [categories, setCategories] = useState<PersonalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PersonalCategory | null>(null);
  const [deleting, setDeleting] = useState<PersonalCategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/personal/categories?active=false");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  async function handleSubmit(data: PersonalCategoryInput) {
    setError(null);
    const url = editing
      ? `/api/personal/categories/${editing.id}`
      : "/api/personal/categories";
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
    fetchCategories();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/personal/categories/${deleting.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Error al eliminar");
    } else {
      fetchCategories();
    }
    setDeleteLoading(false);
    setDeleting(null);
  }

  return (
    <div>
      <Header
        title="Mis Categorías"
        subtitle="Categorías personales exclusivas para ti"
        actions={
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary"
          >
            + Nueva categoría
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
          <button className="ml-2 font-medium underline" onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      ) : categories.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <p className="text-gray-500 font-medium">Sin categorías personales</p>
          <p className="text-gray-400 text-sm mt-1">Crea tu primera categoría para organizar tus pagos</p>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary mt-4 inline-flex"
          >
            + Crear primera categoría
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: cat.color + "22", borderLeft: `4px solid ${cat.color}` }}
                  >
                    <CategoryIcon name={cat.name} />
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cat.name}</p>
                    <p className="text-xs text-gray-400">{TYPE_LABELS[cat.type] ?? cat.type}</p>
                  </div>
                </div>
              </div>

              {cat.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{cat.description}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {cat._count.payments} pago{cat._count.payments !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditing(cat); setShowForm(true); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setDeleting(cat)}
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
        </div>
      )}

      {/* Form Modal */}
      <Sheet
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); setError(null); }}
        title={editing ? "Editar categoría" : "Nueva categoría personal"}
        size="sm"
      >
        <CategoryForm
          defaultValues={editing ? { ...editing, type: editing.type as any } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(null); setError(null); }}
          isEdit={!!editing}
        />
      </Sheet>

      {/* Delete Confirm */}
      {deleting && deleting._count.payments === 0 && (
        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={handleDelete}
          title="Eliminar categoría"
          message={`¿Eliminar la categoría "${deleting?.name}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          loading={deleteLoading}
        />
      )}
      {deleting && deleting._count.payments > 0 && (
        <ConfirmDialog
          open={!!deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => setDeleting(null)}
          title="No se puede eliminar"
          message={`Esta categoría tiene ${deleting._count.payments} pago(s) asociado(s). Reasigna o elimina los pagos primero.`}
          confirmLabel="Entendido"
        />
      )}
    </div>
  );
}
