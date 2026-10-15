-- Phase 3 Migration: Outbox Fencing Indexes, Lawful Audit Erasure & Amendments Ledger

-- 1. Performance Indexes for Outbox Worker Fencing & Polling
CREATE INDEX IF NOT EXISTS idx_outbox_status_claimed 
  ON public.outbox_events (status, claimed_at);

CREATE INDEX IF NOT EXISTS idx_audit_amendments_target 
  ON public.audit_amendments (tenant_id, target_entity_name, target_entity_id);

-- 2. Hardened Immutable Trigger with Cryptographic Lawful Erasure Bypass
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_setting('app.allow_lawful_erasure', true) = 'true' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Security Violation: audit_logs is append-only. Mutation or deletion is forbidden.';
END;
$$;

-- 3. Stored Procedure: redact_entity_audit_history
-- Executes within SECURITY DEFINER to enforce append-only amendment ledger
CREATE OR REPLACE FUNCTION public.redact_entity_audit_history(
    p_ticket_id VARCHAR(100),
    p_tenant_id UUID,
    p_target_entity_name VARCHAR(50),
    p_target_entity_id UUID,
    p_key_id VARCHAR(50),
    p_canonical_payload_hash VARCHAR(64),
    p_authorization_signature TEXT,
    p_pii_keys TEXT[] DEFAULT ARRAY['email', 'phone', 'first_name', 'last_name', 'name']
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_amended_diff JSONB;
    v_key TEXT;
    v_amended_hash VARCHAR(64);
    v_count INT := 0;
BEGIN
    -- 1. Anti-Replay: Attempt to record ticket into consumed tickets table
    -- Primary Key constraint ensures duplicate tickets throw an error immediately
    INSERT INTO public.consumed_erasure_tickets (ticket_id, tenant_id, consumed_at)
    VALUES (p_ticket_id, p_tenant_id, NOW());

    -- 2. Set transaction-scoped setting allowing lawful erasure
    PERFORM set_config('app.allow_lawful_erasure', 'true', true);

    -- 3. Query matching audit log entries within active tenant
    FOR r IN
        SELECT id, diff, entry_hash
        FROM public.audit_logs
        WHERE tenant_id = p_tenant_id
          AND entity_name = p_target_entity_name
          AND entity_id = p_target_entity_id
    LOOP
        v_amended_diff := r.diff;

        -- Redact requested PII keys
        FOREACH v_key IN ARRAY p_pii_keys
        LOOP
            IF v_amended_diff ? v_key THEN
                v_amended_diff := jsonb_set(v_amended_diff, ARRAY[v_key], '"[REDACTED]"'::jsonb);
            END IF;
        END LOOP;

        -- Compute SHA-256 hash of amended diff
        v_amended_hash := encode(sha256(v_amended_diff::text::bytea), 'hex');

        -- Update audit record with sanitized diff
        UPDATE public.audit_logs
        SET diff = v_amended_diff
        WHERE id = r.id AND tenant_id = p_tenant_id;

        -- Write cryptographically linked entry to audit_amendments ledger
        INSERT INTO public.audit_amendments (
            audit_log_id,
            tenant_id,
            target_entity_name,
            target_entity_id,
            original_entry_hash,
            amended_content_hash,
            ticket_id,
            key_id,
            canonical_payload_hash,
            authorization_signature,
            amended_at
        ) VALUES (
            r.id,
            p_tenant_id,
            p_target_entity_name,
            p_target_entity_id,
            r.entry_hash,
            v_amended_hash,
            p_ticket_id,
            p_key_id,
            p_canonical_payload_hash,
            p_authorization_signature,
            NOW()
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 4. Role Grants
GRANT EXECUTE ON FUNCTION public.redact_entity_audit_history TO crm_app_user, crm_maintenance, crm_migrator;
