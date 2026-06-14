import { AlertLevel } from "@/lib/financial/credit-card-calendar";

const BADGE_CONFIG: Record<AlertLevel, { bg: string; text: string; dot: string; label: string }> = {
  overdue:     { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Pago vencido" },
  pay_today:   { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Paga hoy" },
  warning_d1:  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  label: "Paga mañana" },
  warning_d3:  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  label: "Pago próximo" },
  warning_d7:  { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-500",  label: "Prepara pago" },
  risk_zone:   { bg: "bg-amber-100",  text: "text-amber-700",  dot: "bg-amber-400",  label: "Consumo con cuidado" },
  best_moment: { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  label: "Buen momento para consumir" },
  normal:      { bg: "bg-gray-100",   text: "text-gray-600",   dot: "bg-gray-400",   label: "Al corriente" },
};

interface Props {
  alertLevel: AlertLevel;
  microcopy?: string;
  compact?: boolean;
}

export default function CreditCardAdviceBadge({ alertLevel, microcopy, compact = false }: Props) {
  const cfg = BADGE_CONFIG[alertLevel];
  const label = microcopy ?? cfg.label;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
        aria-label={`Estado de tarjeta: ${label}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text}`}
      aria-label={`Estado de tarjeta: ${label}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {label}
    </span>
  );
}
