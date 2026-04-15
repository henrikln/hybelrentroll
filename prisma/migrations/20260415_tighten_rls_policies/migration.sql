-- Tighten RLS policies based on security review findings

-- Fix: allowed_senders INSERT was fully open (WITH CHECK (true))
-- Now restrict to matching account_id or empty/null context (sign-in flow)
DROP POLICY IF EXISTS allowed_senders_tenant_insert ON allowed_senders;
CREATE POLICY allowed_senders_tenant_insert ON allowed_senders
  FOR INSERT WITH CHECK (
    account_id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );

-- Fix: accounts INSERT was fully open (WITH CHECK (true))
-- Now restrict to empty/null context only (new account creation during sign-in)
DROP POLICY IF EXISTS accounts_tenant_insert ON accounts;
CREATE POLICY accounts_tenant_insert ON accounts
  FOR INSERT WITH CHECK (
    current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
    OR id = current_setting('app.current_account_id', true)::uuid
  );
