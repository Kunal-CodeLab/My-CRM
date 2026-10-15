-- Phase 4 Migration: Resumable Chunked CSV Import Jobs Table & RLS Policies

CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    entity_name VARCHAR(50) NOT NULL DEFAULT 'contact',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    deduplication_mode VARCHAR(20) NOT NULL DEFAULT 'SKIP',
    total_rows INT NOT NULL DEFAULT 0,
    processed_rows INT NOT NULL DEFAULT 0,
    successful_rows INT NOT NULL DEFAULT 0,
    failed_rows INT NOT NULL DEFAULT 0,
    raw_csv TEXT,
    error_summary JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_jobs_tenant_id UNIQUE (tenant_id, id)
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_import_jobs') THEN
    CREATE POLICY tenant_isolation_import_jobs ON public.import_jobs
      FOR ALL TO PUBLIC
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO crm_app_user;
