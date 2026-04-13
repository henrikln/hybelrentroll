"use client";

import { useState, useRef } from "react";
import { Pencil, X } from "lucide-react";

export function RenameAccountDialog({
  accountId,
  currentName,
  action,
}: {
  accountId: string;
  currentName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{currentName}</h3>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-gray-300 hover:text-purple-600"
          title="Rediger navn"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">
                Endre kontonavn
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              ref={formRef}
              action={async (formData) => {
                await action(formData);
                setOpen(false);
              }}
            >
              <input type="hidden" name="accountId" value={accountId} />
              <input
                name="name"
                defaultValue={currentName}
                autoFocus
                required
                className="mb-4 h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  className="h-8 rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
                >
                  Lagre
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
