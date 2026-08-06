"use client";

interface ImportResultCardProps {
  success: boolean;
  count?: number;
  message?: string;
  error?: string;
  onClose?: () => void;
  onViewTransactions?: () => void;
  isLoading?: boolean;
}

export default function ImportResultCard({
  success,
  count = 0,
  message,
  error,
  onClose,
  onViewTransactions,
  isLoading = false,
}: ImportResultCardProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-md">
        {/* Icon */}
        {isLoading ? (
          <div className="flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin"></div>
            </div>
          </div>
        ) : success ? (
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-in fade-in zoom-in-50 duration-500">
              <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Title & Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLoading
            ? "Procesando importación..."
            : success
            ? "¡Importación exitosa!"
            : "Error en la importación"}
        </h2>

        {/* Details */}
        {success && !isLoading && (
          <>
            <div className="bg-indigo-50 rounded-lg p-4 mb-6 border border-indigo-200">
              <p className="text-3xl font-bold text-indigo-600 mb-1">{count}</p>
              <p className="text-sm text-indigo-900">
                transacción{count !== 1 ? "es" : ""} importada{count !== 1 ? "s" : ""}
              </p>
            </div>

            {message && (
              <p className="text-gray-600 mb-6">{message}</p>
            )}
          </>
        )}

        {!success && error && !isLoading && (
          <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-200">
            <p className="text-sm text-red-900">{error}</p>
          </div>
        )}

        {isLoading && (
          <p className="text-gray-600 mb-6">Por favor espera mientras procesamos tu archivo...</p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {success && onViewTransactions && (
            <button
              onClick={onViewTransactions}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Ver transacciones
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                success
                  ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {success ? "Cerrar" : "Intentar de nuevo"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
