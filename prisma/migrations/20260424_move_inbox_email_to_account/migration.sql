-- Move inbox_email from companies to accounts. The file's org number now
-- determines which Company within the account the data is imported to,
-- so one inbox can receive rent rolls for many companies.

ALTER TABLE "accounts" ADD COLUMN "inbox_email" TEXT;
CREATE UNIQUE INDEX "accounts_inbox_email_key" ON "accounts"("inbox_email");

-- Copy any existing values from companies → accounts (first non-null per account)
UPDATE "accounts" a
SET inbox_email = sub.inbox_email
FROM (
  SELECT DISTINCT ON (account_id) account_id, inbox_email
  FROM "companies"
  WHERE inbox_email IS NOT NULL
  ORDER BY account_id, created_at ASC
) sub
WHERE a.id = sub.account_id
  AND a.inbox_email IS NULL;

DROP INDEX IF EXISTS "companies_inbox_email_key";
ALTER TABLE "companies" DROP COLUMN "inbox_email";
