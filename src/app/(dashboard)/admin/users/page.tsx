export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  Users,
  Plus,
  Trash2,
  Shield,
  ShieldOff,
  UserX,
  UserCheck,
} from "lucide-react";

async function addUserToAccount(formData: FormData) {
  "use server";
  await requireAdmin();

  const email = (formData.get("email") as string)?.toLowerCase().trim();
  const accountId = formData.get("accountId") as string;
  if (!email || !accountId) return;

  // Check account exists
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return;

  // Create user if not exists
  await prisma.user.upsert({
    where: { email },
    update: { accountId, active: true },
    create: { accountId, email, role: "member" },
  });

  // Ensure allowed sender exists too
  await prisma.allowedSender.upsert({
    where: { email },
    update: { accountId },
    create: { accountId, email, note: "Lagt til av admin" },
  });

  revalidatePath("/admin/users");
}

async function removeUser(formData: FormData) {
  "use server";
  await requireAdmin();

  const userId = formData.get("userId") as string;
  if (!userId) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Remove user and their allowed sender entry
  await prisma.user.delete({ where: { id: userId } });
  await prisma.allowedSender.deleteMany({ where: { email: user.email } });

  revalidatePath("/admin/users");
}

async function toggleAdmin(formData: FormData) {
  "use server";
  await requireAdmin();

  const userId = formData.get("userId") as string;
  const currentRole = formData.get("currentRole") as string;
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { role: currentRole === "admin" ? "member" : "admin" },
  });

  revalidatePath("/admin/users");
}

async function toggleActive(formData: FormData) {
  "use server";
  await requireAdmin();

  const userId = formData.get("userId") as string;
  const currentActive = formData.get("currentActive") as string;
  if (!userId) return;

  await prisma.user.update({
    where: { id: userId },
    data: { active: currentActive === "true" ? false : true },
  });

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  await requireAdmin();

  const accounts = await prisma.account.findMany({
    include: {
      users: { orderBy: { createdAt: "asc" } },
      companies: { select: { id: true, name: true } },
      _count: { select: { companies: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-gray-900">
        Administrer brukere
      </h1>

      {accounts.length === 0 ? (
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm text-gray-400">
            Ingen kontoer registrert ennå
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="rounded-xl border border-gray-100 bg-white shadow-sm"
            >
              {/* Account header */}
              <div className="border-b border-gray-50 px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {account.name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {account._count.companies} selskap
                      {account._count.companies !== 1 ? "er" : ""} ·{" "}
                      Opprettet{" "}
                      {account.createdAt.toLocaleDateString("nb-NO")}
                    </p>
                  </div>
                  {account.companies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {account.companies.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700"
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Users table */}
              <div className="px-5 py-3">
                {account.users.length === 0 ? (
                  <p className="py-3 text-sm text-gray-400">
                    Ingen brukere registrert
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400">
                        <th className="pb-2 font-medium">E-post</th>
                        <th className="pb-2 font-medium">Navn</th>
                        <th className="pb-2 font-medium">Rolle</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Sist pålogget</th>
                        <th className="pb-2 font-medium">Registrert</th>
                        <th className="pb-2 w-32" />
                      </tr>
                    </thead>
                    <tbody>
                      {account.users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-t border-gray-50"
                        >
                          <td className="py-2.5 font-mono text-gray-900">
                            {user.email}
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {user.name ?? "—"}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                user.role === "admin"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {user.role === "admin" ? "Admin" : "Medlem"}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                user.active
                                  ? "bg-green-50 text-green-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {user.active ? "Aktiv" : "Deaktivert"}
                            </span>
                          </td>
                          <td className="py-2.5 text-gray-400">
                            {user.lastLoginAt
                              ? user.lastLoginAt.toLocaleString("nb-NO", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 text-gray-400">
                            {user.createdAt.toLocaleDateString("nb-NO")}
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {/* Toggle admin */}
                              <form action={toggleAdmin}>
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={user.id}
                                />
                                <input
                                  type="hidden"
                                  name="currentRole"
                                  value={user.role}
                                />
                                <button
                                  type="submit"
                                  className="rounded p-1 text-gray-300 hover:bg-gray-50 hover:text-amber-600"
                                  title={
                                    user.role === "admin"
                                      ? "Fjern admin"
                                      : "Gjør til admin"
                                  }
                                >
                                  {user.role === "admin" ? (
                                    <ShieldOff className="h-4 w-4" />
                                  ) : (
                                    <Shield className="h-4 w-4" />
                                  )}
                                </button>
                              </form>

                              {/* Toggle active */}
                              <form action={toggleActive}>
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={user.id}
                                />
                                <input
                                  type="hidden"
                                  name="currentActive"
                                  value={String(user.active)}
                                />
                                <button
                                  type="submit"
                                  className="rounded p-1 text-gray-300 hover:bg-gray-50 hover:text-orange-500"
                                  title={
                                    user.active
                                      ? "Deaktiver bruker"
                                      : "Aktiver bruker"
                                  }
                                >
                                  {user.active ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                </button>
                              </form>

                              {/* Remove user */}
                              <form action={removeUser}>
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={user.id}
                                />
                                <button
                                  type="submit"
                                  className="rounded p-1 text-gray-300 hover:bg-gray-50 hover:text-red-500"
                                  title="Fjern bruker"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add user to this account */}
                <form
                  action={addUserToAccount}
                  className="mt-3 flex gap-2 border-t border-gray-50 pt-3"
                >
                  <input type="hidden" name="accountId" value={account.id} />
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="Legg til bruker (e-post)"
                    className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-8 items-center gap-1 rounded-md bg-purple-600 px-3 text-xs font-medium text-white hover:bg-purple-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Legg til
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
