"use server";

import { revalidatePath } from "next/cache";
import { prisma, setRLSAccountId } from "@/lib/db";
import { getAccountId } from "@/lib/auth";

/**
 * Delete an import along with all derived data:
 *  - rent_roll_snapshots (cascade)
 *  - unit_events (cascade)
 *  - any Property records in the same company that no longer appear in any
 *    remaining snapshot — these are "orphaned" addresses introduced by this
 *    import only. Deleting a Property cascades to Unit, Contract,
 *    SecurityDeposit, RentAdjustment.
 *  - any Leaseholder records in the same company that no longer have contracts.
 *
 * Returns a summary of what was removed.
 */
export async function deleteImport(importId: string): Promise<
  | { ok: true; removedProperties: number; removedLeaseholders: number }
  | { ok: false; error: string }
> {
  const accountId = await getAccountId();
  if (!accountId) {
    return { ok: false, error: "Ikke autentisert" };
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await setRLSAccountId(tx, accountId);

        // Verify the import belongs to this account (RLS also enforces this,
        // but an explicit check gives a cleaner error).
        const imp = await tx.rentRollImport.findFirst({
          where: { id: importId, accountId },
          select: { id: true, companyId: true },
        });

        if (!imp) {
          throw new Error("Import ikke funnet");
        }

        const companyId = imp.companyId;

        // Delete the import — cascades snapshots and unit_events.
        await tx.rentRollImport.delete({ where: { id: imp.id } });

        let removedProperties = 0;
        let removedLeaseholders = 0;

        if (companyId) {
          // Find Property records in this company that no longer appear in any
          // remaining snapshot (matched on street_name + street_number, the
          // unique property key).
          const orphanProps = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT p.id
            FROM properties p
            WHERE p.company_id = ${companyId}::uuid
              AND NOT EXISTS (
                SELECT 1
                FROM rent_roll_snapshots s
                WHERE s.company_id = p.company_id
                  AND s.street_name = p.street_name
                  AND s.street_number = p.street_number
              )
          `;

          if (orphanProps.length > 0) {
            const ids = orphanProps.map((p) => p.id);
            const del = await tx.property.deleteMany({
              where: { id: { in: ids } },
            });
            removedProperties = del.count;
          }

          // Clean up Leaseholders that have no remaining contracts.
          const del = await tx.leaseholder.deleteMany({
            where: {
              companyId,
              contracts: { none: {} },
            },
          });
          removedLeaseholders = del.count;
        }

        return { removedProperties, removedLeaseholders };
      },
      { timeout: 60000 }
    );

    revalidatePath("/import");
    revalidatePath("/eiendommer");
    revalidatePath("/");

    return { ok: true, ...result };
  } catch (err) {
    console.error("[deleteImport] failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Ukjent feil",
    };
  }
}
