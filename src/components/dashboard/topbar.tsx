"use client";

import { Building2 } from "lucide-react";

export function Topbar() {
  // TODO: Replace with Clerk organization/user data
  const orgName = "Nagelgården AS";
  const userName = "Henrik Lie-Nielsen";
  const userEmail = "henrikln@nagelgaarden.no";
  const initials = "HL";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end border-b border-gray-100 bg-white px-6">
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-xs text-gray-400">Organisasjon</p>
          <p className="text-sm font-semibold text-gray-900">{orgName}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-gray-900">{userName}</p>
            <p className="text-xs text-gray-400">{userEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
