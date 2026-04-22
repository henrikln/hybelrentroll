-- Enable RLS on _prisma_migrations (Prisma's internal migration tracking table).
-- Supabase flags this as a security issue since the table is in the public schema.
-- No policies are added: migrations run as the database owner (via DIRECT_URL with
-- superuser/service role credentials) which BYPASSES RLS, while anon/authenticated
-- Supabase roles are fully denied access.

ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;
