"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import StepIndicator from "@/components/statements/StepIndicator";
import BankSelector, { type BankType } from "@/components/statements/BankSelector";
import PdfUploadZone from "@/components/statements/PdfUploadZone";
import TransactionPreviewTable from "@/components/statements/TransactionPreviewTable";
import ImportResultCard from "@/components/statements/ImportResultCard";

interface PreviewData {
  bankName?: string;
  period?: string;
  transactionCount: number;
  transactions: Array<{
    id?: string;
    date: string;
    description: string;
    amount: number;
    chargeAmount?: number;
    creditAmount?: number;
    type?: "debit" | "credit";
    balance?: number;
  }>;
}

const STEPS = [
  "Seleccionar banco",
  "Subir archivo",
  "Revisar datos",
  "Completado",
];

export default function ImportStatementsPage() {
  const router = useRouter();
  const { data: session } = useSession();

  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [bankType, setBankType] = useState<BankType>();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>();
  const [importId, setImportId] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    count?: number;
    message?: string;
    error?: string;
  } | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);

  const canProceedStep = () => {
    if (currentStep === 1) return bankType;
    if (currentStep === 2) return uploadedFile;
    if (currentStep === 3) return previewData && selectedAccountId;
    return true;
  };

  const handleFileSelect = async (file: File) => {
    setUploadedFile(file);
    setError(null);

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Prepare form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankType", bankType || "AUTO_DETECT");

      // Send to backend
      const response = await fetch("/api/personal/statements/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al procesar el archivo");
      }

      const data = await response.json();
      const newImportId = data.importId;
      setImportId(newImportId);

      setUploadProgress(30);

      // Poll for preview until ready
      let retries = 0;
      const maxRetries = 60; // 60 * 500ms = 30 seconds max

      const pollPreview = async (): Promise<boolean> => {
        try {
          const statusResponse = await fetch(
            `/api/personal/statements/import?importId=${newImportId}`
          );

          if (!statusResponse.ok) {
            throw new Error("Error al obtener estado");
          }

          const statusData = await statusResponse.json();
          setUploadProgress(statusData.progress?.percentage || 30);

          if (statusData.status === "COMPLETED" && statusData.preview) {
            setPreviewData({
              bankName: statusData.preview.bankName,
              period: statusData.preview.period,
              transactionCount: statusData.preview.transactionCount || 0,
              transactions: statusData.preview.transactions || [],
            });

            // Also fetch accounts
            const accountsResponse = await fetch("/api/personal/accounts");
            if (accountsResponse.ok) {
              const accountsData = await accountsResponse.json();
              setAccounts(accountsData.data || []);
            }

            setUploadProgress(100);
            setTimeout(() => setCurrentStep(3), 500);
            return true;
          } else if (statusData.status === "FAILED") {
            throw new Error(
              statusData.error?.message || "Error procesando el archivo"
            );
          }

          return false;
        } catch (err) {
          throw err;
        }
      };

      // Poll with increasing delays
      while (retries < maxRetries) {
        retries++;
        const success = await pollPreview();
        if (success) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (retries >= maxRetries) {
        throw new Error("Timeout al procesar el archivo");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      console.error("Upload error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importId || !selectedAccountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/personal/statements/import/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          importId,
          mergeIfExists: true,
          targetAccountId: selectedAccountId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Error al confirmar importación");
      }

      const data = await response.json();

      setImportResult({
        success: true,
        count: data.transactionsCreated || previewData?.transactionCount || 0,
        message: data.message,
      });

      setCurrentStep(4);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setImportResult({
        success: false,
        error: message,
      });
      setCurrentStep(4);
      console.error("Confirm error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 2 && uploadedFile && !previewData) {
      // Already handled in handleFileSelect
      return;
    }
    if (currentStep === 3) {
      await handleConfirmImport();
    } else {
      setCurrentStep(Math.min(currentStep + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(Math.max(currentStep - 1, 1));
  };

  const handleClose = () => {
    if (importResult?.success) {
      router.push("/personal/statements");
    } else {
      setCurrentStep(1);
      setBankType(undefined);
      setUploadedFile(null);
      setPreviewData(null);
      setImportResult(null);
      setError(null);
      setImportId(null);
    }
  };

  const handleViewTransactions = () => {
    router.push("/personal/statements");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Importar Estado de Cuenta</h1>
          <p className="mt-2 text-gray-600">
            Sube tu estado de cuenta en PDF para importar transacciones automáticamente
          </p>
        </div>

        {/* Steps */}
        <StepIndicator currentStep={currentStep} totalSteps={4} steps={STEPS} />

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* Step 1: Bank Selection */}
          {currentStep === 1 && (
            <BankSelector
              selectedBank={bankType}
              onSelect={setBankType}
              disabled={isLoading}
            />
          )}

          {/* Step 2: File Upload */}
          {currentStep === 2 && (
            <PdfUploadZone
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              progress={isLoading ? uploadProgress : undefined}
              error={error}
            />
          )}

          {/* Step 3: Preview */}
          {currentStep === 3 && previewData && (
            <TransactionPreviewTable
              transactions={previewData.transactions}
              bankName={previewData.bankName}
              period={previewData.period}
              onAccountSelect={setSelectedAccountId}
              selectedAccountId={selectedAccountId}
              isLoadingAccounts={isLoading}
              accounts={accounts}
            />
          )}

          {/* Step 4: Result */}
          {currentStep === 4 && importResult && (
            <ImportResultCard
              success={importResult.success}
              count={importResult.count}
              message={importResult.message}
              error={importResult.error}
              isLoading={isLoading}
              onClose={handleClose}
              onViewTransactions={handleViewTransactions}
            />
          )}

          {/* Action Buttons */}
          {currentStep < 4 && (
            <div className="mt-8 flex gap-3 justify-between">
              <button
                onClick={handleBack}
                disabled={currentStep === 1 || isLoading}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  currentStep === 1 || isLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                Atrás
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => router.back()}
                  disabled={isLoading}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    isLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  Cancelar
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canProceedStep() || isLoading}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    !canProceedStep() || isLoading
                      ? "bg-indigo-300 text-white cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  {isLoading ? "Procesando..." : currentStep === 3 ? "Confirmar" : "Siguiente"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
