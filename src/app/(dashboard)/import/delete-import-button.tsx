"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { deleteImport } from "./actions";

interface Props {
  importId: string;
  filename: string;
  company: string;
  reportDate: string;
}

export function DeleteImportButton({
  importId,
  filename,
  company,
  reportDate,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await deleteImport(importId);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Slett import"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isPending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Slett import?
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  Dette fjerner alle data importert fra denne filen — inkludert
                  snapshots, hendelser, og eiendommer/enheter som kun ble lagt
                  inn av denne importen. Handlingen kan ikke angres.
                </p>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-3 text-xs">
              <div className="grid grid-cols-[100px_1fr] gap-y-1">
                <span className="text-gray-500">Selskap:</span>
                <span className="font-medium text-gray-900">{company}</span>
                <span className="text-gray-500">Rapportdato:</span>
                <span className="font-medium text-gray-900">{reportDate}</span>
                <span className="text-gray-500">Filnavn:</span>
                <span className="font-mono text-gray-700 break-all">
                  {filename}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isPending ? "Sletter..." : "Slett import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
