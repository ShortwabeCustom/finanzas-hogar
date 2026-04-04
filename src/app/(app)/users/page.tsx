"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { userSchema, type UserInput } from "@/lib/validations";
import { formatDate, ROLE_LABELS } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  EDITOR: "bg-blue-100 text-blue-800",
  VIEWER: "bg-gray-100 text-gray-700",
};

function UserForm({
  defaultValues, onSubmit, onCancel, isEdit,
}: {
  defaultValues?: Partial<UserInput & { id: string }>;
  onSubmit: (data: UserInput) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UserInput>({
    resolver: zodResolver(userSchema) as any,
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      password: "",
      role: (defaultValues?.role as any) ?? "VIEWER",
      active: defaultValues?.active ?? true,
    },
  });

  useEffect(() => {
    reset({
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      password: "",
      role: (defaultValues?.role as any) ?? "VIEWER",
      active: defaultValues?.active ?? true,
    });
  }, [defaultValues, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" placeholder="Nombre completo" {...register("name")} />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>
      <div>
        <label className="label">Correo electrónico *</label>
        <input type="email" className="input" placeholder="usuario@ejemplo.com" {...register("email")} />
        {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
      </div>
      <div>
        <label className="label">{isEdit ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña *"}</label>
        <input type="password" className="input" placeholder="••••••••" {...register("password")} />
        {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
      </div>
      <div>
        <label className="label">Rol</label>
        <select className="input" {...register("role")}>
          <option value="ADMIN">Administrador — acceso total</option>
          <option value="EDITOR">Editor — puede crear y editar</option>
          <option value="VIEWER">Visualizador — solo lectura</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <input type="checkbox" id="active" className="w-4 h-4 rounded border-gray-300 text-indigo-600" {...register("active")} />
        <label htmlFor="active" className="text-sm text-gray-700">Usuario activo</label>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary" disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar usuario" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}

// Diálogo de eliminación permanente con campo de confirmación
function HardDeleteDialog({
  open, user, onClose, onConfirm, loading,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  const [inputValue, setInputValue] = useState("");
  const confirmWord = user?.name ?? user?.email ?? "";
  const isConfirmed = inputValue.trim() === confirmWord.trim();

  useEffect(() => {
    if (!open) setInputValue("");
  }, [open]);

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Eliminar usuario permanentemente</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <p className="font-semibold mb-1">⚠ Esta acción es irreversible</p>
            <p>El usuario <span className="font-bold">{confirmWord}</span> será eliminado permanentemente de la base de datos. Sus pagos y registros quedarán sin asignar.</p>
          </div>
          <div>
            <label className="label">
              Para confirmar, escribe <span className="font-mono font-bold text-gray-800">{confirmWord}</span>
            </label>
            <input
              className="input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmWord}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary" disabled={loading}>Cancelar</button>
            <button
              onClick={onConfirm}
              disabled={!isConfirmed || loading}
              className="btn-danger"
            >
              {loading ? "Eliminando..." : "Eliminar permanentemente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  // Soft delete (desactivar)
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  // Hard delete (eliminar permanentemente)
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && session.user.role !== "ADMIN") {
      router.replace("/dashboard");
    }
  }, [session, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleSubmit(data: UserInput) {
    setError(null);
    const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
    const method = editingUser ? "PUT" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Error al guardar");
      return;
    }
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  }

  async function handleDeactivate() {
    if (!deactivatingUser) return;
    setDeactivateLoading(true);
    await fetch(`/api/users/${deactivatingUser.id}`, { method: "DELETE" });
    setDeactivateLoading(false);
    setDeactivatingUser(null);
    fetchUsers();
  }

  async function handleHardDelete() {
    if (!deletingUser) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/users/${deletingUser.id}?hard=1`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "Error al eliminar");
    }
    setDeleteLoading(false);
    setDeletingUser(null);
    fetchUsers();
  }

  return (
    <div>
      <Header
        title="Usuarios"
        subtitle="Administración de usuarios y permisos del sistema"
        actions={
          <button onClick={() => { setEditingUser(null); setShowForm(true); }} className="btn-primary">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nuevo usuario
          </button>
        }
      />

      {/* Roles legend */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Descripción de roles</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <span className="inline-flex rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-medium mt-0.5">Admin</span>
            <p className="text-gray-600">Acceso total: usuarios, categorías, pagos y despensa.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium mt-0.5">Editor</span>
            <p className="text-gray-600">Puede crear, editar y eliminar pagos y despensa.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-flex rounded-full bg-gray-100 text-gray-700 px-2.5 py-0.5 text-xs font-medium mt-0.5">Viewer</span>
            <p className="text-gray-600">Solo puede visualizar registros. Sin modificaciones.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Usuario", "Email", "Rol", "Estado", "Registrado", "Acciones"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No hay usuarios registrados</td></tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === session?.user?.id;
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
                            {(user.name ?? user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name ?? "—"}</p>
                            {isSelf && <p className="text-xs text-indigo-500">Tú</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${user.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"}`}>
                          {user.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {/* Editar */}
                          <button
                            onClick={() => { setEditingUser(user); setShowForm(true); }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar usuario"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {!isSelf && (
                            <>
                              {/* Desactivar (soft delete) */}
                              <button
                                onClick={() => setDeactivatingUser(user)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                title={user.active ? "Desactivar usuario" : "Reactivar usuario"}
                              >
                                {user.active ? (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </button>

                              {/* Eliminar permanentemente (hard delete) */}
                              <button
                                onClick={() => setDeletingUser(user)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Eliminar permanentemente"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Leyenda de acciones */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Editar datos
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              Desactivar / Reactivar acceso
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Eliminar permanentemente (irreversible)
            </div>
          </div>
        </div>
      )}

      {/* Modal editar / crear */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingUser(null); setError(null); }}
        title={editingUser ? "Editar usuario" : "Nuevo usuario"}
        size="md"
      >
        {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <UserForm
          defaultValues={editingUser ? { ...editingUser, name: editingUser.name ?? undefined, role: editingUser.role as any, password: "" } : undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingUser(null); setError(null); }}
          isEdit={!!editingUser}
        />
      </Modal>

      {/* Diálogo desactivar */}
      <ConfirmDialog
        open={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={handleDeactivate}
        title={deactivatingUser?.active ? "Desactivar usuario" : "Reactivar usuario"}
        message={
          deactivatingUser?.active
            ? `¿Desactivar a "${deactivatingUser?.name ?? deactivatingUser?.email}"? El usuario perderá acceso al sistema pero sus datos se conservarán.`
            : `¿Reactivar a "${deactivatingUser?.name ?? deactivatingUser?.email}"? El usuario recuperará acceso al sistema.`
        }
        confirmLabel={deactivatingUser?.active ? "Desactivar" : "Reactivar"}
        loading={deactivateLoading}
      />

      {/* Diálogo eliminar permanentemente */}
      <HardDeleteDialog
        open={!!deletingUser}
        user={deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleHardDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
