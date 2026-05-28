export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { requireAdmin, getIsGlobalAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Mail, Save, AlertCircle } from "lucide-react";

const INBOUND_DOMAIN = "estatelab.amp11.no";

async function updateInbox(formData: FormData) {
  "use server";
  const myAccountId = await requireAdmin();
  const isGlobal = await getIsGlobalAdmin();

  const accountId = (formData.get("accountId") as string)?.trim();
  const localRaw = (formData.get("local") as string)?.trim() ?? "";

  if (!accountId) return;

  // Authorisation: tenant admins may only edit their own account.
  if (!isGlobal && accountId !== myAccountId) return;

  // Verify account exists
  const exists = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!exists) return;

  // Sanitize local part: lowercase, only [a-z0-9._-]
  const localPart = localRaw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "");

  const inboxEmail = localPart ? `${localPart}@${INBOUND_DOMAIN}` : null;

  try {
    await prisma.account.update({
      where: { id: accountId },
      data: { inboxEmail },
    });
  } catch (err) {
    console.error("[updateInbox] failed:", err);
  }

  revalidatePath("/admin/inbokser");
}

export default async function InboxesPage() {
  const myAccountId = await requireAdmin();
  const isGlobalAdmin = await getIsGlobalAdmin();

  const accounts = await prisma.account.findMany({
    where: isGlobalAdmin ? undefined : { id: myAccountId },
    include: { _count: { select: { companies: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Innboks-adresse
        </h1>
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="mb-2 font-medium">Slik fungerer det</p>
        <p className="text-blue-800">
          Sett en unik e-postadresse per konto. Alle rent rolls som sendes til
          adressen rutes til kontoen, og organisasjonsnummeret i filen
          bestemmer hvilket selskap dataene legges på. Avsenderen må være
          registrert under <span className="font-medium">Avsendere</span> for
          kontoen.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {accounts.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">Ingen kontoer</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Konto</th>
                <th className="px-4 py-3 font-medium">Selskaper</th>
                <th className="px-4 py-3 font-medium">Innboks-adresse</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => {
                const local = a.inboxEmail ? a.inboxEmail.split("@")[0] : "";
                return (
                  <tr
                    key={a.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {a._count.companies}
                    </td>
                    <td className="px-4 py-3">
                      <form
                        action={updateInbox}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="accountId" value={a.id} />
                        <input
                          name="local"
                          type="text"
                          defaultValue={local}
                          placeholder="(ikke konfigurert)"
                          className="h-8 w-40 rounded-md border border-gray-200 bg-white px-2 text-sm font-mono outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                        />
                        <span className="font-mono text-xs text-gray-400">
                          @{INBOUND_DOMAIN}
                        </span>
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-purple-600 px-3 text-xs font-medium text-white hover:bg-purple-700"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Lagre
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!a.inboxEmail && (
                        <span
                          title="Ikke konfigurert — innkommende e-post til denne kontoen vil bli avvist"
                          className="inline-flex items-center"
                        >
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
