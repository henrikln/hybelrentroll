-- Add per-Company inbox email so inbound mail can be routed to a specific
-- company based on the recipient (to) address.

ALTER TABLE "companies" ADD COLUMN "inbox_email" TEXT;
CREATE UNIQUE INDEX "companies_inbox_email_key" ON "companies"("inbox_email");
