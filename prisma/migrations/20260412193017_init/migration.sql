-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('enebolig', 'leilighet', 'hybel', 'naering', 'annet');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('aktiv', 'ledig', 'oppsagt');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('tidsbestemt', 'tidsubestemt');

-- CreateEnum
CREATE TYPE "SecurityType" AS ENUM ('depositum', 'forsikring', 'garanti', 'ingen');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('email', 'upload', 'api');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "org_number" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerk_user_id" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "street_name" TEXT NOT NULL,
    "street_number" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "postal_place" TEXT NOT NULL,
    "municipality" TEXT,
    "gnr" INTEGER,
    "bnr" INTEGER,
    "snr" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "unit_number" TEXT,
    "custom_number" TEXT,
    "unit_type" "UnitType" NOT NULL DEFAULT 'annet',
    "num_rooms" INTEGER,
    "area_sqm" DECIMAL(8,2),
    "num_bedrooms" INTEGER,
    "floor" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaseholders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "invoice_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaseholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "leaseholder_id" UUID,
    "external_contract_id" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ledig',
    "contract_type" "ContractType",
    "start_date" DATE,
    "end_date" DATE,
    "termination_date" DATE,
    "notice_period_months" INTEGER,
    "earliest_notice_date" DATE,
    "monthly_rent" DECIMAL(10,2),
    "fixed_reduction" DECIMAL(10,2),
    "last_rent_adjustment_date" DATE,
    "next_rent_adjustment_date" DATE,
    "rent_before_last_adjustment" DECIMAL(10,2),
    "cpi_base" DECIMAL(8,2),
    "akonto_electricity" DECIMAL(10,2),
    "akonto_water_sewage" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_deposits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "security_type" "SecurityType" NOT NULL,
    "amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_adjustments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "adjustment_date" DATE NOT NULL,
    "rent_before" DECIMAL(10,2),
    "rent_after" DECIMAL(10,2),
    "cpi_index_base" DECIMAL(8,2),
    "cpi_index_new" DECIMAL(8,2),
    "adjustment_pct" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_roll_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "company_id" UUID,
    "filename" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "sender_email" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "rows_total" INTEGER,
    "rows_imported" INTEGER,
    "rows_failed" INTEGER,
    "error_log" JSONB,
    "file_url" TEXT,
    "imported_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rent_roll_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_senders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allowed_senders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rent_roll_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "import_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "unit_key" TEXT NOT NULL,
    "street_name" TEXT NOT NULL,
    "street_number" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "postal_place" TEXT NOT NULL,
    "gnr" INTEGER,
    "bnr" INTEGER,
    "unit_number" TEXT,
    "custom_number" TEXT,
    "unit_type" TEXT NOT NULL,
    "num_rooms" INTEGER,
    "area_sqm" DECIMAL(8,2),
    "num_bedrooms" INTEGER,
    "floor" INTEGER,
    "external_contract_id" TEXT,
    "status" TEXT NOT NULL,
    "contract_type" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "notice_period_months" INTEGER,
    "earliest_notice_date" DATE,
    "monthly_rent" DECIMAL(10,2),
    "fixed_reduction" DECIMAL(10,2),
    "last_rent_adj_date" DATE,
    "next_rent_adj_date" DATE,
    "rent_before_last_adj" DECIMAL(10,2),
    "cpi_base" DECIMAL(8,2),
    "akonto_electricity" DECIMAL(10,2),
    "akonto_water_sewage" DECIMAL(10,2),
    "leaseholder_name" TEXT,
    "leaseholder_email" TEXT,
    "leaseholder_phone" TEXT,
    "security_type" TEXT,
    "security_amount" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_roll_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "import_id" UUID NOT NULL,
    "unit_key" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_clerk_org_id_key" ON "accounts"("clerk_org_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_account_id_org_number_key" ON "companies"("account_id", "org_number");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "properties_company_id_street_name_street_number_postal_code_key" ON "properties"("company_id", "street_name", "street_number", "postal_code", "gnr", "bnr");

-- CreateIndex
CREATE UNIQUE INDEX "units_property_id_unit_number_custom_number_key" ON "units"("property_id", "unit_number", "custom_number");

-- CreateIndex
CREATE UNIQUE INDEX "leaseholders_company_id_name_email_key" ON "leaseholders"("company_id", "name", "email");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_company_id_external_contract_id_key" ON "contracts"("company_id", "external_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_deposits_contract_id_key" ON "security_deposits"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_senders_email_key" ON "allowed_senders"("email");

-- CreateIndex
CREATE INDEX "rent_roll_snapshots_company_id_unit_key_report_date_idx" ON "rent_roll_snapshots"("company_id", "unit_key", "report_date");

-- CreateIndex
CREATE INDEX "unit_events_company_id_event_date_idx" ON "unit_events"("company_id", "event_date");

-- CreateIndex
CREATE INDEX "unit_events_company_id_unit_key_idx" ON "unit_events"("company_id", "unit_key");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaseholders" ADD CONSTRAINT "leaseholders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_leaseholder_id_fkey" FOREIGN KEY ("leaseholder_id") REFERENCES "leaseholders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_adjustments" ADD CONSTRAINT "rent_adjustments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_adjustments" ADD CONSTRAINT "rent_adjustments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_roll_imports" ADD CONSTRAINT "rent_roll_imports_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_roll_imports" ADD CONSTRAINT "rent_roll_imports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_roll_imports" ADD CONSTRAINT "rent_roll_imports_imported_by_user_id_fkey" FOREIGN KEY ("imported_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_senders" ADD CONSTRAINT "allowed_senders_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_roll_snapshots" ADD CONSTRAINT "rent_roll_snapshots_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "rent_roll_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_roll_snapshots" ADD CONSTRAINT "rent_roll_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_events" ADD CONSTRAINT "unit_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_events" ADD CONSTRAINT "unit_events_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "rent_roll_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
