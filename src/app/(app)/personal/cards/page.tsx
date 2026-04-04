"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/layout/Header";
import Sheet from "@/components/ui/Sheet";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { personalCardSchema, type PersonalCardInput } from "@/lib/validations";

const BANK_COLORS: Record<string, string> = {
  BBVA: "#004990",
  Banorte: "#e30613",
  Santander: "#ec0000",
  HSBC: "#db0011",
  Citibanamex: "#003087",
  Scotiabank: "#ec111a",
  Inbursa: "#0033a0",
  Hey: "#ff6b00",
  "Nu Bank": "#820ad1",
  Nu: "#820ad1",
  Liverpool: "#cc0000",
  "Banco Azteca": "#00a651",
  Otro: "#6366f1",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  BANK_ACCOUNT: "Cuenta bancaria",
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  CREDIT_CARD: "bg-purple-100 text-purple-700",
  DEBIT_CARD: "bg-sky-100 text-sky-700",
  BANK_ACCOUNT: "bg-green-100 text-green-700",
};

interface PersonalCard {
  id: string;
  bankName: string;
  cardName: string;
  last4Digits: string;
  paymentSourceType: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";
  closingDay: number;
  dueDay: number;
  active: boolean;
  _count: { payments: number };
}

const ordinalDay = (d: number) => `${d}°`;

function CardForm({
  defaultValues,
  onSubmit,
  onCancel,
  isEdit,
}: {
  defaultValues?: Partial<PersonalCardInput & { id: string }>;
  onSubmit: (data: PersonalCardInput) => Promise<void>;
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
  } = useForm<PersonalCardInput>({
    resolver: zodResolver(personalCardSchema) as any,
    defaultValues: {
      bankName: defaultValues?.bankName ?? "",
      cardName: defaultValues?.cardName ?? "",
      last4Digits: defaultValues?.last4Digits ?? "",
      paymentSourceType: defaultValues?.paymentSourceType ?? "CREDIT_CARD",
      closingDay: defaultValues?.closingDay as any ?? "",
      dueDay: defaultValues?.dueDay as any ?? "",
      active: defaultValues?.active ?? true,
    },
  });

  const sourceType = useWatch({ control, name: "paymentSourceType" });
  const showDayFields = sourceType === "CREDIT_CARD";

  useEffect(() => {
    reset({
      bankName: defaultValues?.bankName ?? "",
      cardName: defaultValues?.cardName ?? "",
      last4Digits: defaultValues?.last4Digits ?? "",
      paymentSourceType: defaultValues?.paymentSourceType ?? "CREDIT_CARD",
      closingDay: (defaultValues?.closingDay as any) ?? "",
      dueDay: (defaultValues?.dueDay as any) ?? "",
      active: defaultValues?.active ?? true,
    });
  }, [defaultValues, reset]);

  // Reset closing/due day to 0 when not credit card
  useEffect(() => {
    if (!showDayFields) {
      setValue("closingDay", 0);
      setValue("dueDay", 0);
    }
  }, [showDayFields, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Tipo */}
        <div className="col-span-2">
          <label className="label">Tipo de medio de pago *</label>
          <select className="input" {...register("paymentSourceType")}>
            <option value="CREDIT_CARD">Tarjeta de crédito</option>
            <option value="DEBIT_CARD">Tarjeta de débito</option>
            <option value="BANK_ACCOUNT">Cuenta bancaria (transferencia)</option>
          </select>
        </div>

        {/* Banco */}
        <div className="col-span-2">
          <label className="label">Banco *</label>
          <input
            className="input"
            placeholder="Ej: BBVA, Santander, Nu Bank..."
            list="bank-suggestions"
            {...register("bankName")}
          />
          <datalist id="bank-suggestions">
            {Object.keys(BANK_COLORS).filter((b) => b !== "Otro").map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          {errors.bankName && <p className="mt-1 text-xs text-red-600">{errors.bankName.message}</p>}
        </div>

        {/* Nombre */}
        <div className="col-span-2">
          <label className="label">{sourceType === "BANK_ACCOUNT" ? "Nombre de la cuenta *" : "Nombre de la tarjeta *"}</label>
          <input
            className="input"
            placeholder={sourceType === "BANK_ACCOUNT" ? "Ej: Cuenta nómina, Ahorro..." : "Ej: Azul, Oro, Débito nómina..."}
            {...register("cardName")}
          />
          {errors.cardName && <p className="mt-1 text-xs text-red-600">{errors.cardName.message}</p>}
        </div>

        {/* Últimos 4 dígitos */}
        <div>
          <label className="label">Últimos 4 dígitos *</label>
          <input
            className="input"
            placeholder="1234"
            maxLength={4}
            inputMode="numeric"
            {...register("last4Digits")}
          />
          {errors.last4Digits && <p className="mt-1 text-xs text-red-600">{errors.last4Digits.message}</p>}
        </div>

        <div />

        {/* Día de corte y límite — solo para tarjetas de crédito */}
        {showDayFields && (
          <>
            <div>
              <label className="label">Día de corte *</label>
              <input className="input" type="number" min={1} max={31} placeholder="Ej: 15" {...register("closingDay")} />
              <p className="mt-1 text-xs text-gray-400">Día del mes en que cierra el estado de cuenta</p>
              {errors.closingDay && <p className="mt-1 text-xs text-red-600">{errors.closingDay.message}</p>}
            </div>
            <div>
              <label className="label">Día límite de pago *</label>
              <input className="input" type="number" min={1} max={31} placeholder="Ej: 5" {...register("dueDay")} />
              <p className="mt-1 text-xs text-gray-400">Día del mes para pagar sin intereses</p>
              {errors.dueDay && <p className="mt-1 text-xs text-red-600">{errors.dueDay.message}</p>}
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
          {isSubmitting ? "Guardando..." : isEdit ? "Actualizar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

function CardItem({
  card, onEdit, onDelete, onToggle,
}: {
  card: PersonalCard;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const bankColor = BANK_COLORS[card.bankName] ?? BANK_COLORS["Otro"];
  const initials = card.bankName.slice(0, 2).toUpperCase();
  const isCard = card.paymentSourceType === "CREDIT_CARD";

  return (
    <div className={`card p-5 group transition-opacity ${!card.active ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: bankColor }}
          >
            {initials}
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-tight">{card.bankName}</p>
            <p className="text-xs text-gray-500">{card.cardName}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_TYPE_COLORS[card.paymentSourceType]}`}>
            {SOURCE_TYPE_LABELS[card.paymentSourceType]}
          </span>
          {!card.active && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactiva</span>
          )}
        </div>
      </div>

      {/* Card number */}
      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-4">
        <p className="text-xs text-gray-400 mb-0.5">Terminación</p>
        <p className="font-mono font-bold text-gray-800 text-lg tracking-widest">
          •••• {card.last4Digits}
        </p>
      </div>

      {/* Dates (only for credit/debit cards) */}
      {isCard && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-2 bg-indigo-50 rounded-lg">
            <p className="text-xs text-indigo-500 font-medium mb-0.5">Corte</p>
            <p className="text-lg font-bold text-indigo-700">{ordinalDay(card.closingDay)}</p>
            <p className="text-xs text-indigo-400">de cada mes</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <p className="text-xs text-green-500 font-medium mb-0.5">Límite pago</p>
            <p className="text-lg font-bold text-green-700">{ordinalDay(card.dueDay)}</p>
            <p className="text-xs text-green-400">de cada mes</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {card._count.payments} pago{card._count.payments !== 1 ? "s" : ""} asociado{card._count.payments !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggle}
            className={`p-1.5 rounded-lg transition-colors text-gray-400 ${card.active ? "hover:text-amber-600 hover:bg-amber-50" : "hover:text-green-600 hover:bg-green-50"}`}
            title={card.active ? "Desactivar" : "Activar"}
          >
            {card.active ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
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
  );
}

export default function PersonalCardsPage() {
  const [cards, setCards] = useState<PersonalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PersonalCard | null>(null);
  const [deleting, setDeleting] = useState<PersonalCard | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/personal/cards?active=${showAll ? "false" : "true"}`);
    const data = await res.json();
    setCards(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [showAll]);

  useEffect(() => { fetchCards(); }, [fetchCards]);

  async function handleSubmit(data: PersonalCardInput) {
    setError(null);
    const url = editing ? `/api/personal/cards/${editing.id}` : "/api/personal/cards";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Error al guardar");
      return;
    }

    setShowForm(false);
    setEditing(null);
    fetchCards();
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    const res = await fetch(`/api/personal/cards/${deleting.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Error al eliminar");
    } else {
      fetchCards();
    }
    setDeleteLoading(false);
    setDeleting(null);
  }

  async function handleToggle(card: PersonalCard) {
    setError(null);
    const res = await fetch(`/api/personal/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: card.bankName,
        cardName: card.cardName,
        last4Digits: card.last4Digits,
        paymentSourceType: card.paymentSourceType,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        active: !card.active,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Error al actualizar");
    } else {
      fetchCards();
    }
  }

  const activeCount = cards.filter((c) => c.active).length;

  return (
    <div>
      <Header
        title="Mis Tarjetas"
        subtitle="Administra tus tarjetas y cuentas bancarias para asociarlas a tus pagos"
        actions={
          <div className="flex items-center gap-3">
            <button onClick={() => setShowAll((v) => !v)} className="btn-secondary text-sm">
              {showAll ? "Solo activas" : "Ver todas"}
            </button>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="btn-primary"
            >
              + Agregar medio de pago
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button className="font-medium underline ml-2" onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      {cards.length > 0 && (
        <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
          <span>{activeCount} medio{activeCount !== 1 ? "s" : ""} activo{activeCount !== 1 ? "s" : ""}</span>
          {cards.length > activeCount && (
            <span>{cards.length - activeCount} inactivo{cards.length - activeCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        </div>
      ) : cards.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-14 h-14 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-600 font-semibold text-lg">Sin medios de pago registrados</p>
          <p className="text-gray-400 text-sm mt-1 mb-5">
            Registra tus tarjetas y cuentas bancarias para asociarlas a tus pagos personales y compartidos.
          </p>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="btn-primary inline-flex"
          >
            + Agregar primer medio de pago
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onEdit={() => { setEditing(card); setShowForm(true); }}
              onDelete={() => setDeleting(card)}
              onToggle={() => handleToggle(card)}
            />
          ))}
        </div>
      )}

      <Sheet
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); setError(null); }}
        title={editing
          ? `Editar — ${editing.bankName} •••• ${editing.last4Digits}`
          : "Nuevo medio de pago"}
        size="md"
      >
        <CardForm
          defaultValues={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditing(null); setError(null); }}
          isEdit={!!editing}
        />
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminar medio de pago"
        message={
          deleting
            ? `¿Eliminar ${deleting.bankName} •••• ${deleting.last4Digits}? Los pagos asociados perderán la referencia, pero no se eliminarán.`
            : ""
        }
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}
