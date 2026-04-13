export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { requireAdmin, getIsGlobalAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Mail, Plus, Trash2 } from "lucide-react";

async function addSender(formData: FormData) {
  "use server";
  const myAccountId = await requireAdmin();
  const isGlobal = await getIsGlobalAdmin();

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const note = (formData.get("note") as string)?.trim() || null;
  const targetAccountId = (formData.get("accountId") as string)?.trim() || null;

  if (!email) return;

  const existing = await prisma.allowedSender.findUnique({ where: { email } });
  if (existing) return;

  let accountId: string;

  if (isGlobal && targetAccountId === "__new__") {
    // Create a new account for this sender
    const accountName = note || email.split("@")[0];
    const account = await prisma.account.create({
      data: { name: accountName },
    });
    accountId = account.id;
  } else if (isGlobal && targetAccountId) {
    // Verify the target account exists
    const account = await prisma.account.findUnique({ where: { id: targetAccountId } });
    if (!account) return;
    accountId = targetAccountId;
  } else {
    // Tenant admins always add to their own account
    accountId = myAccountId;
  }

  await prisma.allowedSender.create({
    data: { accountId, email, note },
  });

  revalidatePath("/admin/senders");
}

async function removeSender(formData: FormData) {
  "use server";
  const myAccountId = await requireAdmin();
  const isGlobal = await getIsGlobalAdmin();

  const id = formData.get("id") as string;
  if (!id) return;

  const sender = await prisma.allowedSender.findUnique({ where: { id } });
  if (!sender) return;

  // Tenant admins can only remove senders from their own account
  if (!isGlobal && sender.accountId !== myAccountId) return;

  await prisma.allowedSender.delete({ where: { id } });
  revalidatePath("/admin/senders");
}

export default async function SendersPage() {
  const accountId = await requireAdmin();
  const isGlobalAdmin = await getIsGlobalAdmin();

  const senders = await prisma.allowedSender.findMany({
    where: isGlobalAdmin ? undefined : { accountId },
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // For global admins: list all accounts so they can assign senders
  const accounts = isGlobalAdmin
    ? await prisma.account.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">
          Tillatte avsendere
        </h1>
      </div>

      <p className="mb-6 text-sm text-gray-500">
        E-postadresser som kan sende rent roll-filer til{" "}
        <span className="font-mono text-gray-700">
          import@estatelab.amp11.no
        </span>
        . Innloggede brukere registreres automatisk.
      </p>

      {/* Add form */}
      <form action={addSender} className="mb-6 flex gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="epost@eksempel.no"
          className="h-9 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
        />
        <input
          name="note"
          type="text"
          placeholder="Notat (valgfritt)"
          className="h-9 w-48 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
        />
        {isGlobalAdmin && (
          <select
            name="accountId"
            className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
          >
            <option value={accountId}>Min konto</option>
            <option value="__new__">+ Ny konto</option>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        )}
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-purple-600 px-4 text-sm font-medium text-white hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Legg til
        </button>
      </form>

      {/* Senders list */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {senders.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-400">
              Ingen avsendere registrert ennå
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="px-4 py-3 font-medium">E-post</th>
                <th className="px-4 py-3 font-medium">Konto</th>
                <th className="px-4 py-3 font-medium">Notat</th>
                <th className="px-4 py-3 font-medium">Registrert</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {senders.map((sender) => (
                <tr
                  key={sender.id}
                  className="border-b border-gray-50 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-gray-900">
                    {sender.email}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {sender.account.name}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {sender.note ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {sender.createdAt.toLocaleDateString("nb-NO")}
                  </td>
                  <td className="px-4 py-3">
                    <form action={removeSender}>
                      <input type="hidden" name="id" value={sender.id} />
                      <button
                        type="submit"
                        className="text-gray-300 hover:text-red-500"
                        title="Fjern avsender"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
