"use client";

import { ArrowRightLeft } from "lucide-react";
import { useRef } from "react";

export function CompanyMoveSelect({
  companyId,
  accounts,
  moveAction,
}: {
  companyId: string;
  accounts: { id: string; name: string }[];
  moveAction: (formData: FormData) => Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  return (
    <form ref={formRef} action={moveAction} className="inline relative">
      <input type="hidden" name="companyId" value={companyId} />
      <button
        type="button"
        onClick={() => selectRef.current?.showPopover?.() || selectRef.current?.click()}
        className="text-purple-400 hover:text-purple-700"
        title="Flytt til annen konto"
      >
        <ArrowRightLeft className="h-3 w-3" />
      </button>
      <select
        ref={selectRef}
        name="targetAccountId"
        onChange={() => formRef.current?.requestSubmit()}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        defaultValue=""
      >
        <option value="" disabled>
          Flytt til...
        </option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </form>
  );
}
