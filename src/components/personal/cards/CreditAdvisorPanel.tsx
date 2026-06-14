"use client";

import {
  CreditAdvisorAlert,
  CreditAdvisorRecommendation,
  InsightType,
} from "@/lib/financial/credit-card-calendar";

// ─── Style maps ────────────────────────────────────────────────────────────────

const PANEL_STYLES: Record<InsightType, { border: string; bg: string; icon: string; iconColor: string }> = {
  critical:    { border: "border-red-200",    bg: "bg-red-50",     icon: "!", iconColor: "text-red-600 bg-red-100" },
  warning:     { border: "border-amber-200",  bg: "bg-amber-50",   icon: "!", iconColor: "text-amber-600 bg-amber-100" },
  opportunity: { border: "border-green-200",  bg: "bg-green-50",   icon: "↑", iconColor: "text-green-600 bg-green-100" },
  info:        { border: "border-indigo-200", bg: "bg-indigo-50",  icon: "i", iconColor: "text-indigo-600 bg-indigo-100" },
};

const REC_STYLES: Record<InsightType, { dot: string; title: string }> = {
  critical:    { dot: "bg-red-500",    title: "text-red-700" },
  warning:     { dot: "bg-amber-500",  title: "text-amber-700" },
  opportunity: { dot: "bg-green-500",  title: "text-green-700" },
  info:        { dot: "bg-indigo-500", title: "text-indigo-700" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function AlertBanner({ alert }: { alert: CreditAdvisorAlert }) {
  const s = PANEL_STYLES[alert.severity];
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 p-3 rounded-xl border ${s.border} ${s.bg}`}
    >
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${s.iconColor}`}
        aria-hidden="true"
      >
        {s.icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 leading-tight">
          {alert.cardLabel}
        </p>
        <p className="text-xs text-gray-600 mt-0.5 leading-snug">{alert.message}</p>
      </div>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: CreditAdvisorRecommendation }) {
  const s = REC_STYLES[rec.type];
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden="true" />
        <p className={`text-xs font-semibold truncate ${s.title}`}>{rec.title}</p>
      </div>
      <p className="text-xs text-gray-500 leading-snug font-medium mb-0.5">
        {rec.cardLabel}
      </p>
      <p className="text-xs text-gray-500 leading-snug">{rec.description}</p>
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="card p-4 mb-6 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
      <div className="h-14 bg-gray-100 rounded-xl mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  alerts: CreditAdvisorAlert[];
  recommendations: CreditAdvisorRecommendation[];
  loading?: boolean;
  emptyState?: boolean;
}

export default function CreditAdvisorPanel({ alerts, recommendations, loading, emptyState }: Props) {
  if (loading) return <SkeletonPanel />;

  if (emptyState) {
    return (
      <div className="card p-4 mb-6 bg-indigo-50 border border-indigo-100">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold" aria-hidden="true">i</span>
          <div>
            <p className="text-sm font-semibold text-gray-900">Asesor de crédito</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Agrega una tarjeta de crédito con fecha de corte y límite de pago para activar recomendaciones.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const primaryAlert = alerts[0] ?? null;
  const primaryStyle = primaryAlert ? PANEL_STYLES[primaryAlert.severity] : PANEL_STYLES.info;

  return (
    <div className={`card p-4 mb-6 border ${primaryAlert ? primaryStyle.border : "border-gray-100"}`}>
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Asesor de crédito
      </h2>

      {/* Critical alerts */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-3" role="list" aria-label="Alertas de pago">
          {alerts.slice(0, 3).map((a) => (
            <div key={`${a.last4Digits}-${a.dueDate}`} role="listitem">
              <AlertBanner alert={a} />
            </div>
          ))}
        </div>
      )}

      {/* Recommendations grid */}
      {recommendations.length > 0 && (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          role="list"
          aria-label="Recomendaciones por tarjeta"
        >
          {recommendations.map((rec) => (
            <div key={`${rec.last4Digits}-${rec.bankName}`} role="listitem">
              <RecommendationCard rec={rec} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
