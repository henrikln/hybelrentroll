-- AlterTable
ALTER TABLE "users" ADD COLUMN "global_admin" BOOLEAN NOT NULL DEFAULT false;

-- Set existing super admins
UPDATE "users" SET "global_admin" = true WHERE "email" = 'henrikln@nagelgaarden.no';
