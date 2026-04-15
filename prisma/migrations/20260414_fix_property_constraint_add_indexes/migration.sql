-- Step 1: Merge duplicate Property records that share (company_id, street_name, street_number)
-- but differ in postal_code, gnr, or bnr. Keep the one with the lowest id (oldest).

-- Move units from duplicate properties to the "keeper" property
UPDATE units u
SET property_id = keeper.id
FROM properties p
JOIN (
  SELECT company_id, street_name, street_number, (array_agg(id ORDER BY created_at ASC))[1] AS id
  FROM properties
  GROUP BY company_id, street_name, street_number
) keeper
  ON keeper.company_id = p.company_id
  AND keeper.street_name = p.street_name
  AND keeper.street_number = p.street_number
WHERE u.property_id = p.id
  AND p.id != keeper.id;

-- Delete the duplicate property records (units have been moved)
DELETE FROM properties p
WHERE EXISTS (
  SELECT 1
  FROM properties keeper
  WHERE keeper.company_id = p.company_id
    AND keeper.street_name = p.street_name
    AND keeper.street_number = p.street_number
    AND keeper.id < p.id
);

-- Step 2: Handle any unit unique constraint violations from the merge
-- (same propertyId + unitNumber + customNumber). Keep the one with latest updated_at.
DELETE FROM units u1
WHERE EXISTS (
  SELECT 1 FROM units u2
  WHERE u2.property_id = u1.property_id
    AND u2.unit_number = u1.unit_number
    AND u2.custom_number = u1.custom_number
    AND u2.updated_at > u1.updated_at
);

-- Step 3: Drop old constraint, add new narrower constraint
DROP INDEX IF EXISTS "properties_company_id_street_name_street_number_postal_code_g_key";
DROP INDEX IF EXISTS "properties_company_id_street_name_street_number_postal_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "properties_company_id_street_name_street_number_key" ON "properties"("company_id", "street_name", "street_number");

-- Step 4: Add missing index for snapshot queries by company + reportDate
CREATE INDEX IF NOT EXISTS "idx_snapshot_company_report_date" ON "rent_roll_snapshots"("company_id", "report_date");
