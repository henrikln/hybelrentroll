-- DropIndex
DROP INDEX "accounts_clerk_org_id_key";

-- DropIndex
DROP INDEX "users_clerk_user_id_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "clerk_org_id";

-- AlterTable
ALTER TABLE "leaseholders" ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "email" SET DEFAULT '';

-- AlterTable
ALTER TABLE "properties" ALTER COLUMN "gnr" SET NOT NULL,
ALTER COLUMN "gnr" SET DEFAULT 0,
ALTER COLUMN "bnr" SET NOT NULL,
ALTER COLUMN "bnr" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "units" ALTER COLUMN "unit_number" SET NOT NULL,
ALTER COLUMN "unit_number" SET DEFAULT '',
ALTER COLUMN "custom_number" SET NOT NULL,
ALTER COLUMN "custom_number" SET DEFAULT '';

-- AlterTable
ALTER TABLE "users" DROP COLUMN "clerk_user_id";

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
