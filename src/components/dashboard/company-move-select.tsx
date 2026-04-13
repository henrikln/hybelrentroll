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

  return (
    <form ref={formRef} action={moveAction} className="inline">
      <input type="hidden" name="companyId" value={companyId} />
      <select
        name="targetAccountId"
        onChange={() => formRef.current?.requestSubmit()}
        className="sr-only"
        id={`move-${companyId}`}
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
      <label
        htmlFor={`move-${companyId}`}
        className="cursor-pointer text-purple-400 hover:text-purple-700"
        title="Flytt til annen konto"
      >
        <ArrowRightLeft className="h-3 w-3" />
      </label>
    </form>
  );
}
