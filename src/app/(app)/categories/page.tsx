"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLimpiarCampos } from "@/hooks/useLimpiarCampos";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { categorySchema, type CategoryInput } from "@/lib/validations";
import {
  CATEGORY_ICON_LIBRARY,
  CATEGORY_PRESET_COLORS,
  CategoryGlyph,
  getCategoryIconTheme,
  resolveCategoryIconId,
} from "@/lib/category-visuals";

const PRESET_COLORS = CATEGORY_PRESET_COLORS;

const EMPTY_CATEGORY_VALUES = {
  name: "", description: "", color: "#6366f1", icon: "", type: "BOTH" as const,
};

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

function CategoryIcon({ name, icon }: { name: string; icon?: string | null }) {
  const iconId = resolveCategoryIconId(icon, name);
  return <CategoryGlyph iconId={iconId} className="w-5 h-5" />;
}

function CategoryForm({
  defaultValues, onSubmit, onCancel, isEdit,
}: {
  defaultValues?: Partial<CategoryInput & { id: string }>;
  onSubmit: (data: CategoryInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<CategoryInput>({
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
  const selectedIcon = watch("icon");

  const limpiarCampos = useLimpiarCampos(reset, EMPTY_CATEGORY_VALUES);

  useEffect(() => {
    reset({
      name: defaultValues?.name ?? "",
      description: defaultValues?.description ?? "",
      color: defaultValues?.color ?? "#6366f1",
      icon: defaultValues?.icon ?? "",
      type: defaultValues?.type ?? "BOTH",
    });
  }, [defaultValues, reset]);

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
      <div>
        <label className="label">Ícono</label>
        <input type="hidden" {...register("icon")} />
        <div className="grid grid-cols-8 gap-2">
          {CATEGORY_ICON_LIBRARY.map((option) => {
            const selected = selectedIcon === option.id;
            return (
              <button
                key={option.id}
                type="button"
                title={option.label}
                onClick={() => setValue("icon", option.id, { shouldValidate: true })}
                className={`h-9 w-9 rounded-lg border transition-all flex items-center justify-center ${selected ? "border-indigo-600 ring-2 ring-indigo-200" : "border-gray-200 hover:border-gray-300"}`}
              >
                <CategoryGlyph iconId={option.id} className="w-4 h-4 text-slate-700" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>Cancelar</button>
        <button type="button" onClick={limpiarCampos} className="btn-secondary" disabled={isSubmitting}>Limpiar campos</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Crear categoría"}
        </button>
      </div>
    </form>
  );
}

export default function CategoriesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "VIEWER";
  const canEdit = role === "ADMIN" || role === "EDITOR";
  const canDelete = role === "ADMIN" || role === "EDITOR";

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
          canEdit ? (
            <button onClick={() => { setEditingCat(null); setShowForm(true); }} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Nueva categoría
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-5 group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={getCategoryIconTheme(cat.color).containerStyle}
                  >
                    <span style={getCategoryIconTheme(cat.color).iconStyle}>
                      <CategoryIcon name={cat.name} icon={cat.icon} />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{cat.name}</p>
                    <p className="text-xs text-gray-400">{TYPE_LABELS[cat.type] ?? cat.type}</p>
                  </div>
                </div>
              </div>

              {cat.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{cat.description}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {cat._count?.payments ?? 0} pago{(cat._count?.payments ?? 0) !== 1 ? "s" : ""} ·{" "}
                  {cat._count?.pantryItems ?? 0} despensa
                </span>
                {canEdit && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditingCat(cat); setShowForm(true); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeletingCat(cat)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Desactivar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {categories.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p>No hay categorías. ¡Crea la primera!</p>
            </div>
          )}
        </div>
      )}

      <Sheet open={showForm} onClose={() => { setShowForm(false); setEditingCat(null); }} title={editingCat ? "Editar categoría" : "Nueva categoría"} size="md">
        <CategoryForm
          defaultValues={editingCat ? { ...editingCat, type: editingCat.type as any } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingCat(null); }}
          isEdit={!!editingCat}
        />
      </Sheet>

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
