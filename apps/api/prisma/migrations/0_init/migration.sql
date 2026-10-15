-- Baseline Multi-Tenant Schema Migration
-- Includes Composite Foreign Keys, Matching Unique Constraints, RLS, and Partitions

-- 1. Global Identity Tables
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(63) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    session_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_memberships_tenant_user UNIQUE (tenant_id, user_id),
    CONSTRAINT uq_memberships_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refresh_token_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    active_token_id UUID,
    encrypted_active_tokens BYTEA,
    active_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.refresh_token_families(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    rotated_at TIMESTAMPTZ,
    successor_token_id UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tenant Domain Tables
CREATE TABLE IF NOT EXISTS public.tenant_quotas (
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    metric VARCHAR(50) NOT NULL,
    current_count INT NOT NULL DEFAULT 0,
    max_limit INT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, metric)
);

CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_id UUID,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    annual_revenue NUMERIC(15, 2),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_accounts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_accounts_owner FOREIGN KEY (tenant_id, owner_id)
        REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    account_id UUID,
    owner_id UUID,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    job_title VARCHAR(100),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_contacts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_contacts_account FOREIGN KEY (tenant_id, account_id)
        REFERENCES public.accounts(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_contacts_owner FOREIGN KEY (tenant_id, owner_id)
        REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pipelines_tenant_id UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.deal_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL,
    probability_percentage INT NOT NULL DEFAULT 0,
    is_won BOOLEAN NOT NULL DEFAULT FALSE,
    is_lost BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_deal_stages_tenant_pipeline_id UNIQUE (tenant_id, pipeline_id, id),
    CONSTRAINT uq_deal_stages_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_deal_stages_pipeline FOREIGN KEY (tenant_id, pipeline_id)
        REFERENCES public.pipelines(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT chk_stages_terminal CHECK (NOT (is_won = TRUE AND is_lost = TRUE))
);

CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    account_id UUID,
    primary_contact_id UUID,
    pipeline_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    owner_id UUID,
    version INT NOT NULL DEFAULT 1,
    expected_close_date DATE,
    lost_reason TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_deals_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_deals_account FOREIGN KEY (tenant_id, account_id)
        REFERENCES public.accounts(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_deals_contact FOREIGN KEY (tenant_id, primary_contact_id)
        REFERENCES public.contacts(tenant_id, id) ON DELETE SET NULL,
    CONSTRAINT fk_deals_stage FOREIGN KEY (tenant_id, pipeline_id, stage_id)
        REFERENCES public.deal_stages(tenant_id, pipeline_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_deals_owner FOREIGN KEY (tenant_id, owner_id)
        REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body TEXT,
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deal_id UUID,
    contact_id UUID,
    account_id UUID,
    created_by_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_activities_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_activities_deal FOREIGN KEY (tenant_id, deal_id)
        REFERENCES public.deals(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_contact FOREIGN KEY (tenant_id, contact_id)
        REFERENCES public.contacts(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_account FOREIGN KEY (tenant_id, account_id)
        REFERENCES public.accounts(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_creator FOREIGN KEY (tenant_id, created_by_id)
        REFERENCES public.memberships(tenant_id, user_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    claim_token UUID,
    fence_token INT NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    idempotency_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.export_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    outbox_id UUID NOT NULL REFERENCES public.outbox_events(id) ON DELETE CASCADE,
    generation_id INT NOT NULL DEFAULT 1,
    worker_token UUID,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    total_chunks INT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64),
    byte_length BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.export_snapshot_chunks (
    snapshot_id UUID NOT NULL REFERENCES public.export_snapshots(id) ON DELETE CASCADE,
    generation_id INT NOT NULL,
    chunk_index INT NOT NULL,
    data_blob BYTEA NOT NULL,
    PRIMARY KEY (snapshot_id, generation_id, chunk_index)
);

-- 3. Range-Partitioned Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID,
    entity_name VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    diff JSONB NOT NULL,
    entry_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Initial Monthly Partitions
CREATE TABLE IF NOT EXISTS public.audit_logs_y2026m10 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_logs_y2026m11 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS public.audit_amendments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_log_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_entity_name VARCHAR(50) NOT NULL,
    target_entity_id UUID NOT NULL,
    original_entry_hash VARCHAR(64) NOT NULL,
    amended_content_hash VARCHAR(64) NOT NULL,
    ticket_id VARCHAR(100) NOT NULL UNIQUE,
    key_id VARCHAR(50) NOT NULL,
    canonical_payload_hash VARCHAR(64) NOT NULL,
    authorization_signature TEXT NOT NULL,
    amended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.consumed_erasure_tickets (
    ticket_id VARCHAR(100) PRIMARY KEY,
    tenant_id UUID NOT NULL,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Row Level Security Enablement
ALTER TABLE public.tenant_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_quotas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.export_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Child Partitions RLS
ALTER TABLE public.audit_logs_y2026m10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m10 FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_y2026m11 FORCE ROW LEVEL SECURITY;

-- 5. Standard Fail-Closed RLS Policies
DO $$
BEGIN
  -- Accounts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_accounts') THEN
    CREATE POLICY tenant_isolation_accounts ON public.accounts
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Contacts
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_contacts') THEN
    CREATE POLICY tenant_isolation_contacts ON public.contacts
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Deals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_deals') THEN
    CREATE POLICY tenant_isolation_deals ON public.deals
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Pipelines
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_pipelines') THEN
    CREATE POLICY tenant_isolation_pipelines ON public.pipelines
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Deal Stages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_deal_stages') THEN
    CREATE POLICY tenant_isolation_deal_stages ON public.deal_stages
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Activities
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_activities') THEN
    CREATE POLICY tenant_isolation_activities ON public.activities
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Tenant Quotas
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_tenant_quotas') THEN
    CREATE POLICY tenant_isolation_tenant_quotas ON public.tenant_quotas
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Outbox Events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_outbox_events') THEN
    CREATE POLICY tenant_isolation_outbox_events ON public.outbox_events
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;

  -- Audit Logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_audit_logs') THEN
    CREATE POLICY tenant_isolation_audit_logs ON public.audit_logs
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;
END $$;

-- 6. Append-Only Trigger on Audit Logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: audit_logs is append-only. Mutation or deletion is forbidden.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable_y2026m10 ON public.audit_logs_y2026m10;
CREATE TRIGGER trg_audit_logs_immutable_y2026m10
BEFORE UPDATE OR DELETE ON public.audit_logs_y2026m10
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable_y2026m11 ON public.audit_logs_y2026m11;
CREATE TRIGGER trg_audit_logs_immutable_y2026m11
BEFORE UPDATE OR DELETE ON public.audit_logs_y2026m11
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- 7. Database Roles and Least-Privilege Grants
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_system_user') THEN
    CREATE ROLE crm_system_user WITH LOGIN PASSWORD 'local_system_secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_app_user') THEN
    CREATE ROLE crm_app_user WITH LOGIN PASSWORD 'local_app_secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_maintenance') THEN
    CREATE ROLE crm_maintenance WITH LOGIN PASSWORD 'local_maintenance_secret' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crm_migrator') THEN
    CREATE ROLE crm_migrator WITH LOGIN PASSWORD 'local_migrator_secret' CREATEDB NOCREATEROLE;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO crm_app_user, crm_system_user, crm_maintenance, crm_migrator;

-- Ordinary tenant application access
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.organizations,
    public.users,
    public.memberships,
    public.accounts,
    public.contacts,
    public.pipelines,
    public.deal_stages,
    public.deals,
    public.activities,
    public.tenant_quotas,
    public.outbox_events,
    public.export_snapshots,
    public.export_snapshot_chunks,
    public.organization_invitations,
    public.refresh_token_families,
    public.refresh_tokens,
    public.audit_amendments,
    public.consumed_erasure_tickets
TO crm_app_user;

-- Bootstrap and Identity Context grants for crm_system_user
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.organizations,
    public.users,
    public.memberships,
    public.organization_invitations,
    public.refresh_token_families,
    public.refresh_tokens
TO crm_system_user;

-- Partitioned audit log access: parent table only, INSERT and SELECT only
GRANT SELECT, INSERT ON public.audit_logs TO crm_app_user;
REVOKE UPDATE, DELETE ON public.audit_logs FROM crm_app_user;

-- Direct application-role access to audit child partitions denied
REVOKE ALL ON public.audit_logs_y2026m10, public.audit_logs_y2026m11 FROM crm_app_user, PUBLIC;

