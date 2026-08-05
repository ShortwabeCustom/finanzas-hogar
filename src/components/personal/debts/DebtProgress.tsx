interface DebtProgressProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getProgressColor(progress: number): string {
  if (progress === 0) return "bg-gray-400";
  if (progress === 100) return "bg-emerald-600";
  return "bg-indigo-600";
}

export default function DebtProgress({
  progress,
  size = "md",
  showLabel = true,
}: DebtProgressProps) {
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  const progressValue = Math.min(100, Math.max(0, progress));
  const progressColor = getProgressColor(progressValue);

  return (
    <div className="space-y-1">
      <div
        className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressValue)}
        aria-label={`Progreso de pago: ${Math.round(progressValue)}%`}
      >
        <div
          className={`${progressColor} h-full rounded-full transition-all duration-300`}
          style={{ width: `${progressValue}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-600 text-right">{Math.round(progressValue)}%</p>
      )}
    </div>
  );
}
