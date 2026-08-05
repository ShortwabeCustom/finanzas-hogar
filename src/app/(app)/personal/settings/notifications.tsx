"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
} from "lucide-react";

interface DebtAccount {
  id: string;
  name: string;
  currentPrincipal: number;
  nextDueDate: string | null;
}

interface NotificationLog {
  id: string;
  debtId: string;
  debt?: DebtAccount;
  type: "EMAIL" | "WHATSAPP";
  status: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
  createdAt: string;
}

interface NotificationConfig {
  debtId: string;
  emailNotification: boolean;
  emailDaysBefore: number;
  whatsappNotification: boolean;
  whatsappDaysBefore: number;
}

export default function NotificationsSettings() {
  const [debts, setDebts] = useState<DebtAccount[]>([]);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string>("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingSend, setTestingSend] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [debtsRes, historyRes] = await Promise.all([
        fetch("/api/personal/debts?direction=PAYABLE"),
        fetch("/api/personal/notifications/history?limit=20"),
      ]);

      if (debtsRes.ok) {
        const debtsData = await debtsRes.json();
        setDebts(debtsData);
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData);
      }
    } catch (error) {
      toast.error("Error al cargar datos de notificaciones");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSave = async () => {
    try {
      const res = await fetch("/api/personal/user/phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: userPhone }),
      });

      if (!res.ok) throw new Error("Error al guardar teléfono");
      toast.success("Teléfono guardado");
      setEditingPhone(false);
    } catch (error) {
      toast.error("No se pudo guardar el teléfono");
    }
  };

  const handleTestSend = async (debtId: string) => {
    try {
      setTestingSend(debtId);
      const res = await fetch(`/api/personal/debts/${debtId}/notifications/test`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Error al enviar notificación");
      toast.success("Notificación de prueba enviada");
    } catch (error) {
      toast.error("Error al enviar notificación de prueba");
    } finally {
      setTestingSend(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-3 text-slate-400 animate-spin">
            <Bell />
          </div>
          <p className="text-slate-600 dark:text-slate-400">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
              Configuración de Notificaciones
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base">
            Manage cuándo y cómo recibir alertas sobre tus deudas
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-6 lg:px-8 py-8 space-y-8">
        {/* Sección 1: Datos de Contacto */}
        <section className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-slate-400" />
              Datos de Contacto
            </h2>
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Email (Read-only) */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Email de Cuenta
              </label>
              <input
                id="email"
                type="email"
                value={userEmail}
                readOnly
                className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 cursor-not-allowed"
                placeholder="Tu email de cuenta"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Este es tu email de cuenta registrado
              </p>
            </div>

            {/* Teléfono WhatsApp (Editable) */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Teléfono WhatsApp (Opcional)
              </label>

              {!editingPhone ? (
                <div className="flex gap-2">
                  <input
                    id="phone"
                    type="tel"
                    value={userPhone || ""}
                    readOnly
                    className="flex-1 h-10 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    placeholder="+56 9 1234 5678"
                  />
                  <button
                    onClick={() => setEditingPhone(true)}
                    className="px-4 h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    Editar
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="phone-edit"
                    type="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    className="flex-1 h-10 px-3 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-blue-600 focus:border-transparent transition-all duration-200"
                    placeholder="+56 9 1234 5678"
                    autoFocus
                  />
                  <button
                    onClick={handlePhoneSave}
                    className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              )}

              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Requerido para notificaciones por WhatsApp
              </p>
            </div>
          </div>
        </section>

        {/* Sección 2: Notificaciones por Deuda */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Notificaciones por Deuda
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Configura cuándo recibir alertas para cada deuda
            </p>
          </div>

          {debts.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
              <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                No hay deudas a pagar registradas
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {debts.map((debt) => (
                <DebtNotificationCard
                  key={debt.id}
                  debt={debt}
                  userPhone={userPhone}
                  onTestSend={() => handleTestSend(debt.id)}
                  isLoading={testingSend === debt.id}
                />
              ))}
            </div>
          )}
        </section>

        {/* Sección 3: Historial de Notificaciones */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Historial Reciente
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Últimas 20 notificaciones enviadas
            </p>
          </div>
          <NotificationHistory history={history} />
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Componente: DebtNotificationCard
// ============================================================================

interface DebtNotificationCardProps {
  debt: DebtAccount;
  userPhone: string;
  onTestSend: () => void;
  isLoading?: boolean;
}

function DebtNotificationCard({
  debt,
  userPhone,
  onTestSend,
  isLoading = false,
}: DebtNotificationCardProps) {
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailDays, setEmailDays] = useState("3");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappDays, setWhatsappDays] = useState("1");

  const formatCurrency = (value: any) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0,
    }).format(typeof value === "number" ? value : 0);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "No definida";
    return new Intl.DateTimeFormat("es-CL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-slate-300 dark:hover:border-slate-600 transition-colors duration-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">
            {debt.name}
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-xs">Saldo Actual</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {formatCurrency(debt.currentPrincipal)}
              </p>
            </div>
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-xs">Vencimiento</p>
              <p className="font-medium text-slate-900 dark:text-white">
                {formatDate(debt.nextDueDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Test Send Button */}
        <button
          onClick={onTestSend}
          disabled={isLoading}
          className={`ml-4 flex-shrink-0 px-4 py-2 h-10 rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer
            ${isLoading
              ? "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800"
            }`}
          aria-label={`Enviar notificación de prueba para ${debt.name}`}
        >
          {isLoading ? "Enviando..." : "Enviar ahora"}
        </button>
      </div>

      {/* Toggles */}
      <div className="px-6 py-5 space-y-4">
        {/* Email Notification */}
        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <input
                id={`email-${debt.id}`}
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="w-5 h-5 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 dark:focus:ring-offset-slate-800"
                aria-label="Habilitar notificaciones por email"
              />
              <label
                htmlFor={`email-${debt.id}`}
                className="font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                Notificación por Email
              </label>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
              Recibirás un email de recordatorio
            </p>
          </div>

          {emailEnabled && (
            <select
              value={emailDays}
              onChange={(e) => setEmailDays(e.target.value)}
              className="h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all duration-200"
              aria-label="Días antes para notificación por email"
            >
              {[1, 2, 3, 5, 7].map((d) => (
                <option key={d} value={d}>
                  {d} día{d > 1 ? "s" : ""} antes
                </option>
              ))}
            </select>
          )}
        </div>

        {/* WhatsApp Notification */}
        <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <input
                id={`whatsapp-${debt.id}`}
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                disabled={!userPhone}
                className="w-5 h-5 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 dark:focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Habilitar notificaciones por WhatsApp"
              />
              <label
                htmlFor={`whatsapp-${debt.id}`}
                className="font-medium text-slate-900 dark:text-white cursor-pointer"
              >
                Notificación por WhatsApp
              </label>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 ml-7">
              {userPhone ? userPhone : "⚠️ Agregar teléfono para habilitar"}
            </p>
          </div>

          {whatsappEnabled && userPhone && (
            <select
              value={whatsappDays}
              onChange={(e) => setWhatsappDays(e.target.value)}
              className="h-9 px-3 text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all duration-200"
              aria-label="Días antes para notificación por WhatsApp"
            >
              {[0, 1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? "Día del vencimiento" : `${d} día${d > 1 ? "s" : ""} antes`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Componente: NotificationHistory
// ============================================================================

interface NotificationHistoryProps {
  history: NotificationLog[];
}

function NotificationHistory({ history }: NotificationHistoryProps) {
  if (!history?.length) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
        <Bell className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-600 dark:text-slate-400">
          No hay notificaciones aún
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                Deuda
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                Tipo
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                Estado
              </th>
              <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map((n) => (
              <tr
                key={n.id}
                className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors duration-150"
              >
                <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                  {n.debt?.name}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                      n.type === "EMAIL"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {n.type === "EMAIL" ? "📧" : "💬"} {n.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
                      n.status === "SENT"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                        : n.status === "FAILED"
                        ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                        : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {n.status === "SENT" && (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {n.status === "FAILED" && (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    {n.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-sm">
                  {new Date(n.createdAt).toLocaleDateString("es-CL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-700">
        {history.map((n) => (
          <div key={n.id} className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="font-medium text-slate-900 dark:text-white">
                {n.debt?.name}
              </div>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  n.status === "SENT"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : n.status === "FAILED"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                }`}
              >
                {n.status}
              </span>
            </div>
            <div className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                {n.type === "EMAIL" ? "📧" : "💬"} {n.type}
              </span>
              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded">
                {new Date(n.createdAt).toLocaleDateString("es-CL")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
