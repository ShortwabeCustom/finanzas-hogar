import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

interface StatusBadgeProps {
  status: string;
  labels?: Record<string, string>;
  styles?: Record<string, string>;
}

export default function StatusBadge({ status, labels = STATUS_LABELS, styles = statusStyles }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}
