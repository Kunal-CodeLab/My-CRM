# REST API Conventions & Contracts — Commercial Multi-Tenant SaaS CRM

**Document Version:** 1.0.0  
**Status:** Frozen & Approved for Implementation  
**Protocol:** RESTful JSON over HTTPS (OpenAPI 3.0 Spec)  
**Base URL:** `/api/v1`  

---

## 1. General API Standards

### 1.1 Serialization & Date Formatting
* **Payload Format:** JSON (`application/json`).
* **Casing:** `camelCase` for all request/response object keys.
* **Timestamps:** ISO 8601 UTC strings (`2026-10-13T12:00:00.000Z`).
* **Currencies & Decimals:** Serialized as stringified numbers (e.g., `"125000.50"`) to prevent IEEE-754 floating-point rounding discrepancies.
* **Identifiers:** Stringified UUID v7 format (`01924b10-6bc7-7f8e-a2b1-123456789abc`).

### 1.2 Tenant Context & Authentication Headers
* **Authentication Header:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
* **Tenant Claim:** The active tenant ID is extracted from the verified JWT claim (`tid`). 
* **Organization Switching:** Executed via `POST /api/v1/auth/switch-organization` which returns a scoped JWT for the target organization.

---

## 2. Pagination, Filtering & Sorting

### 2.1 Cursor-Based Pagination (Default for High-Volume Records)
Used on `/contacts`, `/accounts`, and `/activities`:
* **Request Query:**
  `GET /api/v1/contacts?limit=25&cursor=eyJpZCI6IjAxOTI0YjEwLTZiYzcifQ`
* **Response Envelope:**
  ```json
  {
    "data": [
      {
        "id": "01924b10-6bc7-7f8e-a2b1-123456789abc",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@acme.corp"
      }
    ],
    "meta": {
      "limit": 25,
      "hasNextPage": true,
      "nextCursor": "eyJpZCI6IjAxOTI0YjEwLTIzNDUifQ"
    }
  }
  ```

### 2.2 Filtering & Sorting Parameters
* Simple field equality: `?ownerId=01924b10-...`
* Range filtering: `?createdAfter=2026-10-01T00:00:00Z&createdBefore=2026-10-31T23:59:59Z`
* Search query: `?q=acme` (executes case-insensitive prefix search against indexed text)
* Sorting: `?sort=createdAt:desc` or `?sort=value:asc`

---

## 3. Standardized Error Envelope (RFC 7807)

Every client and server error returns a predictable RFC 7807 problem detail envelope:

```json
{
  "type": "https://api.crm.domain/errors/validation-failed",
  "title": "Validation Failed",
  "status": 422,
  "detail": "The payload contains invalid field values.",
  "instance": "/api/v1/deals",
  "traceId": "req_01HE7A598BXYZ",
  "errors": [
    {
      "field": "value",
      "message": "value must be a positive decimal number"
    },
    {
      "field": "expectedCloseDate",
      "message": "expectedCloseDate must be an ISO 8601 date string"
    }
  ]
}
```

### Standard Status Codes
* `200 OK`: Successful read or update.
* `201 Created`: Successful entity creation.
* `204 No Content`: Successful deletion.
* `400 Bad Request`: Malformed syntax or missing query parameters.
* `401 Unauthorized`: Missing or invalid token, or membership revoked.
* `402 Payment Required`: Tenant quota or plan limit exceeded.
* `403 Forbidden`: Insufficient role permissions or ownership violation.
* `404 Not Found`: Resource does not exist within the active tenant context.
* `409 Conflict`: Optimistic lock version conflict (`version` mismatch).
* `422 Unprocessable Entity`: DTO validation failure.
* `429 Too Many Requests`: Rate limit exceeded.
* `500 Internal Server Error`: Unhandled server exception (sanitized in production).

---

## 4. Core Endpoint Contracts

### 4.1 Authentication & Tenancy
* `POST /api/v1/auth/register` — Initial user & organization registration.
* `POST /api/v1/auth/login` — Issues access token + sets rotating `HttpOnly` refresh cookie.
* `POST /api/v1/auth/refresh` — Rotates refresh token with 30s recovery convergence.
* `POST /api/v1/auth/switch-organization` — Issues new scoped JWT for target tenant.
* `POST /api/v1/auth/logout` — Revokes current token family and clears cookie.
* `POST /api/v1/invitations/accept` — Claims invitation token and creates membership.

### 4.2 CRM Core Endpoints
* `GET /api/v1/accounts` — Cursor paginated list of accounts.
* `POST /api/v1/accounts` — Create company account.
* `GET /api/v1/contacts` — Cursor paginated list of contacts.
* `POST /api/v1/contacts` — Create individual contact.
* `GET /api/v1/pipelines` — Retrieve tenant pipelines and ordered stages.
* `GET /api/v1/deals` — Pipeline view (supports `?pipelineId=...` grouped by stage).
* `POST /api/v1/deals` — Create new deal (enforces Level-1 quota lock).
* `PATCH /api/v1/deals/:id/stage` — Stage transition (requires `{ newStageId, expectedVersion }`).
* `PATCH /api/v1/deals/:id` — Standard deal attribute update with optimistic locking.

### 4.3 Activities, Imports & Exports
* `GET /api/v1/activities` — Timeline events for deal, contact, or account.
* `POST /api/v1/activities` — Log note, task, or call.
* `POST /api/v1/exports/contacts` — Enqueues asynchronous CSV export (Admin only).
* `GET /api/v1/exports/:id` — Retrieve export status & presigned download URL.
* `POST /api/v1/imports/contacts` — Multipart upload of CSV file for async ingestion.
* `GET /api/v1/imports/:id` — Retrieve import status, row count, and error summary.
