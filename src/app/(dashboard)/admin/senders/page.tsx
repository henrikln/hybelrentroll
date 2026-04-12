export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Mail, Plus, Trash2 } from "lucide-react";

async function getSenders() {
  return prisma.allowedSender.findMany({
    include: { account: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

async function addSender(formData: FormData) {
  "use server";

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (!email) return;

  // Find an existing account or create one
  const existing = await prisma.allowedSender.findUnique({ where: { email } });
  if (existing) return; // already exists

  // Use the first account (single-tenant for now)
  let account = await prisma.account.findFirst();
  if (!account) {
    account = await prisma.account.create({
      data: { name: "Standard" },
    });
  }

  await prisma.allowedSender.create({
    data: { accountId: account.id, email, note },
  });

  revalidatePath("/admin/senders");
}

async function removeSender(formData: FormData) {
  "use server";

  const id = formData.get("id") as string;
  if (!id) return;

  await prisma.allowedSender.delete({ where: { id } });
  revalidatePath("/admin/senders");
}

export default async function SendersPage() {
  const senders = await getSenders();

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
          import@send.estatelab.amp11.no
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
