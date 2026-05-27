export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { requireAdmin, getIsGlobalAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Building2, Save, AlertCircle } from "lucide-react";

const INBOUND_DOMAIN = "estatelab.amp11.no";

async function updateInbox(formData: FormData) {
  "use server";
  const myAccountId = await requireAdmin();
  const isGlobal = await getIsGlobalAdmin();

  const companyId = (formData.get("companyId") as string)?.trim();
  const localRaw = (formData.get("local") as string)?.trim() ?? "";

  if (!companyId) return;

  // Authorisation: tenant admins may only edit their own companies.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { accountId: true },
  });
  if (!company) return;
  if (!isGlobal && company.accountId !== myAccountId) return;

  // Sanitize local part: lowercase, only [a-z0-9._-]
  const localPart = localRaw
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, ""); // trim leading/trailing separators

  const inboxEmail = localPart ? `${localPart}@${INBOUND_DOMAIN}` : null;

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { inboxEmail },
    });
  } catch (err) {
    // Unique-constraint violation = address taken
    console.error("[updateInbox] failed:", err);
  }

  revalidatePath("/admin/inbokser");
}

export default async function InboxesPage() {
  const accountId = await requireAdmin();
  const isGlobalAdmin = await getIsGlobalAdmin();

  const companies = await prisma.company.findMany({
    where: isGlobalAdmin ? undefined : { accountId },
    include: { account: { select: { name: true } } },
    orderBy: [{ account: { name: "asc" } }, { name: "asc" }],
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Innbokser per selskap
        </h1>
      </div>

      <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="mb-2 font-medium">Slik fungerer det</p>
        <p className="text-blue-800">
          Sett en unik e-postadresse per selskap. Når rent rolls sendes til
          adressen rutes de automatisk til riktig selskap. Avsenderen må være
          registrert under <span className="font-medium">Avsendere</span> i
          samme konto.
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {companies.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">Ingen selskaper ennå</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">Selskap</th>
                <th className="px-4 py-3 font-medium">Orgnr</th>
                {isGlobalAdmin && (
                  <th className="px-4 py-3 font-medium">Konto</th>
                )}
                <th className="px-4 py-3 font-medium">Innboks-adresse</th>
                <th className="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const local = c.inboxEmail
                  ? c.inboxEmail.split("@")[0]
                  : "";
                return (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {c.orgNumber}
                    </td>
                    {isGlobalAdmin && (
                      <td className="px-4 py-3 text-gray-600">
                        {c.account.name}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <form
                        action={updateInbox}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="companyId" value={c.id} />
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
                      {!c.inboxEmail && (
                        <span
                          title="Ikke konfigurert — e-post til dette selskapet vil bli avvist"
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
