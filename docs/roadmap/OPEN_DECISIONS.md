# Open Decisions & Deferred Backlog — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  

---

## 1. Unresolved External & Legal Dependencies (Pre-Launch Gates)

The following items are explicit business, legal, and vendor dependencies that must be confirmed prior to commercial paying customer onboarding, but **do not block Phase 0–4 technical implementation**:

1. **Mandatory Legal Review of Retention & Privacy:**
   * *Status:* Pending Qualified Legal Counsel Engagement.
   * *Requirement:* Formal legal review of the 91–121 day audit retention schedule, lawful erasure procedures, and Data Processing Addendum (DPA) under India's Digital Personal Data Protection Act, 2023 (DPDPA) and GDPR.
   * *Notice:* Writing technical architecture specifications does not constitute certified legal compliance.
2. **Transactional Email Service Provider Agreement:**
   * *Options:* Resend (recommended for developer velocity) vs. Postmark vs. AWS SES.
   * *Working Decision:* Use Resend for Phase 1 pilot; review deliverability and pricing before Phase 2.
3. **Object Storage Compliance Verification:**
   * *Options:* Cloudflare R2 (zero egress fees) vs. AWS S3 (formal compliance-certified Object Lock).
   * *Working Decision:* Use Cloudflare R2 for local dev/staging; empirically test retention policy enforcement against legal immutability requirements before commercial launch.

---

## 2. Prioritized Deferred Backlog (Post-Pilot Scope)

The following capabilities are deliberately excluded from the Phase 1 Pilot to protect solo-developer velocity and prevent premature complexity:

### Phase 2: Commercial Growth Enhancements
* **Dynamic JSONB Custom Fields:** Enable tenant administrators to define custom contact and deal attributes validated via JSON Schema with GIN indexing.
* **Automated Multi-Currency Conversion:** Integrate daily European Central Bank (ECB) exchange rate feeds for multi-currency pipeline rollups.
* **Outgoing Webhooks:** Event-driven webhook dispatcher for third-party integrations (Zapier, Make).
* **Payment Gateway Integration:** Native Stripe billing synchronization (checkout, invoice generation, subscription downgrade webhooks).

### Phase 3: Enterprise Platform Enhancements
* **Two-Way Email Sync:** OAuth integration with Google Workspace and Microsoft 365 for automated email timeline logging.
* **Granular Custom RBAC Builder:** Dynamic custom role creation with per-module granular permission overrides.
* **Multi-Region Data Partitions:** Geographically partitioned database nodes for strict European Union data residency compliance.
* **Custom Vanity Domains:** Automated Let's Encrypt SSL certificate provisioning for tenant-specific CNAME routing (`acme.crm.domain`).
