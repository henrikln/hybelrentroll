"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

interface ImportEvent {
  unitKey: string;
  eventType: string;
  description: string;
}

interface ImportResult {
  orgName: string;
  orgNumber: string | null;
  reportDate: string | null;
  totalRows: number;
  parsedRows: number;
  errorCount: number;
  errors: { row: number; field: string; message: string }[];
  properties: string[];
  events: ImportEvent[];
  snapshotCount: number;
}

export default function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(".xlsx")) {
      setError("Kun .xlsx-filer støttes");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/internal/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Feil ved opplasting: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ukjent feil");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Import</h1>

      {/* Upload zone */}
      <div
        className={`mb-6 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          isDragging
            ? "border-purple-400 bg-purple-50"
            : "border-gray-200 bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <FileSpreadsheet className="mx-auto mb-4 h-12 w-12 text-gray-300" />
        <p className="mb-2 text-sm text-gray-600">
          Dra og slipp en .xlsx-fil hit, eller
        </p>
        <label>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileSelect}
          />
          <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
            Velg fil
          </span>
        </label>
        {isProcessing && (
          <p className="mt-4 text-sm text-purple-600">Behandler fil...</p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-emerald-500" />
            <h3 className="text-base font-semibold text-gray-900">
              Import fullført
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Organisasjon</p>
              <p className="text-sm font-medium">
                {result.orgName}
                {result.orgNumber && (
                  <span className="text-gray-400"> ({result.orgNumber})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Rapportdato</p>
              <p className="text-sm font-medium">{result.reportDate ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Rader importert</p>
              <p className="text-sm font-medium">
                {result.parsedRows} / {result.totalRows}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Eiendommer</p>
              <p className="text-sm font-medium">{result.properties.length}</p>
            </div>
          </div>

          {result.properties.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">Eiendommer funnet</p>
              <div className="flex flex-wrap gap-2">
                {result.properties.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.events && result.events.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-1">
                {result.events.length} hendelser oppdaget
              </p>
              <div className="max-h-60 overflow-auto rounded bg-purple-50 p-3 text-xs space-y-1">
                {result.events.map((e, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                    <span className="text-gray-700">{e.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.events && result.events.length === 0 && result.snapshotCount > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400">
                {result.snapshotCount} snapshots lagret — ingen endringer siden forrige import
              </p>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs text-red-500 mb-1">
                {result.errorCount} feil
              </p>
              <div className="max-h-40 overflow-auto rounded bg-red-50 p-3 text-xs text-red-700">
                {result.errors.map((e, i) => (
                  <p key={i}>
                    Rad {e.row}: {e.field} — {e.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
