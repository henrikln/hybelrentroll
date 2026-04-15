import Image from "next/image";
import { prisma, setRLSContext } from "@/lib/db";
import { PeriodSelector } from "./period-selector";

async function getSession() {
  try {
    const { auth } = await import("@/lib/auth");
    return await auth();
  } catch {
    return null;
  }
}

export async function Topbar() {
  const session = await getSession();
  const user = session?.user;
  const accountId = (session as { accountId?: string } | null)?.accountId;

  const userName = user?.name ?? "Bruker";
  const userEmail = user?.email ?? "";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Get available report periods for this account
  let periods: string[] = [];
  if (accountId) {
    await setRLSContext(accountId);
    const snapshots = await prisma.rentRollSnapshot.findMany({
      where: { company: { accountId } },
      select: { reportDate: true },
      distinct: ["reportDate"],
      orderBy: { reportDate: "desc" },
    });
    periods = snapshots.map((s) => s.reportDate.toISOString().split("T")[0]);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-6">
      <div>
        {periods.length > 1 && <PeriodSelector periods={periods} />}
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-400">{userEmail}</p>
        </div>

        {user?.image ? (
          <Image
            src={user.image}
            alt={userName}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
            {initials}
          </div>
        )}

        {user && (
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Logg ut
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
