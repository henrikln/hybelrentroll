"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Building2 } from "lucide-react";

export function Topbar() {
  const { user } = useUser();

  const userName = user?.fullName ?? user?.firstName ?? "Bruker";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-end border-b border-gray-100 bg-white px-6">
      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-gray-400">Konto</p>
          <p className="text-sm font-semibold text-gray-900">{userName}</p>
        </div>

        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-10 w-10",
            },
          }}
        />
      </div>
    </header>
  );
}
