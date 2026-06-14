"use client";

import { useState, useCallback, useRef } from "react";
import toast from "react-hot-toast";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  importEndpoint?: string;
}

export default function StatementImportCard({ onSuccess, onCancel, importEndpoint = "/api/personal/statements/import" }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    const isPdf = f.type === "application/pdf";
    const isXml = f.type.includes("xml") || f.name.toLowerCase().endsWith(".xml");
    if (!isPdf && !isXml) {
      toast.error("Solo se aceptan archivos PDF o XML de Santander");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("El archivo no debe superar 10 MB");
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(importEndpoint, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo importar el estado de cuenta");
        return;
      }
      setResult(data);
      if (data.imported > 0) {
        toast.success(`Importación exitosa: ${data.imported} transacciones importadas`);
        onSuccess();
      } else if (data.skipped > 0 && data.imported === 0) {
        toast.success("El período ya estaba importado — no hay duplicados");
        onSuccess();
      } else {
        toast.error("No se encontraron transacciones en el archivo");
      }
    } catch {
      toast.error("Error de red al importar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [file, onSuccess]);

  return (
    <div className="card p-6 space-y-4" role="region" aria-label="Importar estado de cuenta">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Importar estado de cuenta</h2>
          <p className="text-xs text-gray-500 mt-0.5">Sube tu estado de cuenta en PDF o XML de Santander (CFDI-ECB)</p>
        </div>
        <button
          onClick={onCancel}
          aria-label="Cerrar panel de importación"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Área para soltar o seleccionar archivo PDF o XML"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 transition-colors cursor-pointer
          ${dragOver ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf,.xml,text/xml,application/xml"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <>
            <svg className={`w-10 h-10 ${file.name.toLowerCase().endsWith(".xml") ? "text-indigo-500" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-700 text-center">{file.name}</p>
            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar</p>
          </>
        ) : (
          <>
            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-sm text-gray-500 text-center">
              <span className="font-medium text-indigo-600">Selecciona</span> o arrastra tu PDF
            </p>
            <p className="text-xs text-gray-400">PDF o XML de Santander · Máx. 10 MB</p>
          </>
        )}
      </div>

      {/* Result summary */}
      {result && (
        <div role="status" aria-live="polite" className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm">
          <p className="font-medium text-green-800">Importación completada</p>
          <ul className="mt-1 text-green-700 text-xs space-y-0.5">
            <li>Transacciones importadas: {result.imported}</li>
            <li>Omitidas (duplicadas): {result.skipped}</li>
            {result.errors.length > 0 && (
              <li className="text-amber-700">Advertencias: {result.errors.length}</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
        <button onClick={onCancel} className="btn-secondary w-full sm:w-auto" disabled={loading}>
          Cancelar
        </button>
        <button
          onClick={handleImport}
          disabled={!file || loading}
          aria-label="Iniciar importación del estado de cuenta"
          className="btn-primary w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Procesando...
            </span>
          ) : "Importar"}
        </button>
      </div>
    </div>
  );
}
