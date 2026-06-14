"use client";

interface ApiErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ApiErrorState({
  message = "No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.",
  onRetry,
  className = "",
}: ApiErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-xl border border-red-200 bg-red-50 p-6 text-center ${className}`}
    >
      <div className="flex justify-center mb-3">
        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </span>
      </div>
      <p className="text-sm font-medium text-red-700 mb-1">Error al cargar</p>
      <p className="text-xs text-red-600 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          aria-label="Reintentar carga de datos"
          className="btn-primary text-xs px-4 py-2"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
