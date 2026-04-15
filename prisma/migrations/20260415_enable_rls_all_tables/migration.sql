-- Enable Row-Level Security on all tables
-- Strategy:
--   1. App sets `app.current_account_id` via SET LOCAL per request
--   2. Tables with direct account_id: policy checks account_id = current_setting
--   3. Tables scoped via company_id: policy joins to companies.account_id
--   4. accounts table: only the row matching current account
--   5. A bypass role for migrations/service operations

-- ============================================================
-- 0. Helper: allow the GUC to be set without pre-declaring it
-- ============================================================
-- Supabase already allows custom GUCs, but ensure the default is empty string
-- so current_setting doesn't throw when not set.

-- ============================================================
-- 1. ACCOUNTS — root tenant table
-- ============================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_tenant_select ON accounts
  FOR SELECT USING (
    id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );
  -- Empty/null during sign-in (account lookup via AllowedSender include)

CREATE POLICY accounts_tenant_insert ON accounts
  FOR INSERT WITH CHECK (true);
  -- New account creation happens during sign-in (no account_id set yet)

CREATE POLICY accounts_tenant_update ON accounts
  FOR UPDATE USING (
    id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY accounts_tenant_delete ON accounts
  FOR DELETE USING (
    id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 2. USERS — direct account_id
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_tenant_select ON users
  FOR SELECT USING (
    account_id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );
  -- Empty/null setting during sign-in and JWT callback (user lookup by email)

CREATE POLICY users_tenant_insert ON users
  FOR INSERT WITH CHECK (
    account_id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );
  -- Empty/null setting during sign-in flow for new users

CREATE POLICY users_tenant_update ON users
  FOR UPDATE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );
  -- Empty/null during sign-in (user upsert updates lastLoginAt)

CREATE POLICY users_tenant_delete ON users
  FOR DELETE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 3. COMPANIES — direct account_id
-- ============================================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_tenant_select ON companies
  FOR SELECT USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY companies_tenant_insert ON companies
  FOR INSERT WITH CHECK (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY companies_tenant_update ON companies
  FOR UPDATE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY companies_tenant_delete ON companies
  FOR DELETE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 4. ALLOWED_SENDERS — direct account_id
-- ============================================================
ALTER TABLE allowed_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY allowed_senders_tenant_select ON allowed_senders
  FOR SELECT USING (
    account_id = current_setting('app.current_account_id', true)::uuid
    OR current_setting('app.current_account_id', true) = ''
    OR current_setting('app.current_account_id', true) IS NULL
  );
  -- Empty/null setting during sign-in and webhook (lookup by email before account known)

CREATE POLICY allowed_senders_tenant_insert ON allowed_senders
  FOR INSERT WITH CHECK (true);
  -- Created during sign-in for new users (no account_id yet)

CREATE POLICY allowed_senders_tenant_update ON allowed_senders
  FOR UPDATE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY allowed_senders_tenant_delete ON allowed_senders
  FOR DELETE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 5. API_KEYS — direct account_id
-- ============================================================
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_keys_tenant_select ON api_keys
  FOR SELECT USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY api_keys_tenant_insert ON api_keys
  FOR INSERT WITH CHECK (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY api_keys_tenant_update ON api_keys
  FOR UPDATE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY api_keys_tenant_delete ON api_keys
  FOR DELETE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 6. RENT_ROLL_IMPORTS — direct account_id
-- ============================================================
ALTER TABLE rent_roll_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY rent_roll_imports_tenant_select ON rent_roll_imports
  FOR SELECT USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY rent_roll_imports_tenant_insert ON rent_roll_imports
  FOR INSERT WITH CHECK (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY rent_roll_imports_tenant_update ON rent_roll_imports
  FOR UPDATE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

CREATE POLICY rent_roll_imports_tenant_delete ON rent_roll_imports
  FOR DELETE USING (
    account_id = current_setting('app.current_account_id', true)::uuid
  );

-- ============================================================
-- 7. PROPERTIES — via company_id → companies.account_id
-- ============================================================
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY properties_tenant_select ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = properties.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY properties_tenant_insert ON properties
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = properties.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY properties_tenant_update ON properties
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = properties.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY properties_tenant_delete ON properties
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = properties.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 8. UNITS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY units_tenant_select ON units
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = units.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY units_tenant_insert ON units
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = units.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY units_tenant_update ON units
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = units.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY units_tenant_delete ON units
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = units.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 9. LEASEHOLDERS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE leaseholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY leaseholders_tenant_select ON leaseholders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = leaseholders.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY leaseholders_tenant_insert ON leaseholders
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = leaseholders.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY leaseholders_tenant_update ON leaseholders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = leaseholders.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY leaseholders_tenant_delete ON leaseholders
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = leaseholders.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 10. CONTRACTS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contracts_tenant_select ON contracts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = contracts.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY contracts_tenant_insert ON contracts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = contracts.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY contracts_tenant_update ON contracts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = contracts.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY contracts_tenant_delete ON contracts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = contracts.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 11. SECURITY_DEPOSITS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE security_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_deposits_tenant_select ON security_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = security_deposits.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY security_deposits_tenant_insert ON security_deposits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = security_deposits.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY security_deposits_tenant_update ON security_deposits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = security_deposits.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY security_deposits_tenant_delete ON security_deposits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = security_deposits.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 12. RENT_ADJUSTMENTS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE rent_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY rent_adjustments_tenant_select ON rent_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_adjustments.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_adjustments_tenant_insert ON rent_adjustments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_adjustments.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_adjustments_tenant_update ON rent_adjustments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_adjustments.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_adjustments_tenant_delete ON rent_adjustments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_adjustments.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 13. RENT_ROLL_SNAPSHOTS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE rent_roll_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY rent_roll_snapshots_tenant_select ON rent_roll_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_roll_snapshots.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_roll_snapshots_tenant_insert ON rent_roll_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_roll_snapshots.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_roll_snapshots_tenant_update ON rent_roll_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_roll_snapshots.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY rent_roll_snapshots_tenant_delete ON rent_roll_snapshots
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = rent_roll_snapshots.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

-- ============================================================
-- 14. UNIT_EVENTS — via company_id → companies.account_id
-- ============================================================
ALTER TABLE unit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY unit_events_tenant_select ON unit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = unit_events.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY unit_events_tenant_insert ON unit_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = unit_events.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY unit_events_tenant_update ON unit_events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = unit_events.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );

CREATE POLICY unit_events_tenant_delete ON unit_events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = unit_events.company_id
        AND c.account_id = current_setting('app.current_account_id', true)::uuid
    )
  );
