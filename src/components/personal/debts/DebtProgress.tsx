interface DebtProgressProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function DebtProgress({ progress, size = "md", showLabel = true }: DebtProgressProps) {
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  const progressValue = Math.min(100, Math.max(0, progress));

  return (
    <div className="space-y-1">
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
          style={{ width: `${progressValue}%` }}
        />
      </div>
      {showLabel && <p className="text-xs text-gray-600 text-right">{Math.round(progressValue)}%</p>}
    </div>
  );
}
