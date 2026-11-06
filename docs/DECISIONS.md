# Decisions

- 2026-11-06: User prioritises free tiers and a working MVP, with backups/logging scaffolding only. This supersedes the earlier plan's active backup/monitoring requirements. No paid resources provisioned in P0; no guarantee of perpetual free Azure hosting.
- Core application records, backup storage if enabled later, and operational logs if enabled later stay in South Africa. Identity/email exceptions require explicit review. Region target: South Africa North, subject to SKU/allowance verification.
- Revise handover Track A to React/TypeScript/Vite + ASP.NET Core 10 + PostgreSQL. One codebase; no Supabase or Floot production backend. Use mature ASP.NET Core Identity in P1; do not build custom cryptography.
- P0 UI is a clearly labelled, in-memory preview. Role switching is a demo device, never an authentication mechanism. Business API requests fail closed with 401. No real users or children's records are accepted.
- PostgreSQL local container stores only infrastructure state in P0. Domain schema/migrations arrive in P1/P2, informed by DATA_MODEL.md. UI/API contract linkage and OpenAPI generation are future work.
- Dates shown in the preview use a fixed fictional November 2026 schedule. Instants render in Africa/Johannesburg; no current-date inference or live response deadline enforcement is claimed.
- Mutable drafts and immutable squad publications are separate concepts. Latest published outcomes remain unchanged during draft edits. The preview demonstrates this interaction; database guarantees come in P6.
- Keep user experience lightweight: no remote assets, no animation library, system fonts, CSS transitions with reduced-motion support. No service worker/offline personal-data cache in P0; installable PWA work remains P8.
- Authentication, CSRF protections for cookie sessions, authorisation, audit events and role isolation remain mandatory product security work. Deferring centralised logging does not remove future business audit requirements.

## P1 implementation

- Real accounts now live under `/app`; the unauthenticated synthetic UI moved to `/preview` and has no authority over real accounts.
- ASP.NET Core Identity with EF Core/PostgreSQL provides cookie sessions, email verification/reset, authenticator MFA and recovery codes. Staff actions require MFA; current database memberships remain authoritative.
- A separate database migration principal and non-owner `club_app` runtime role enforce least privilege. Domain RLS is enabled with explicit grants; fixed SECURITY DEFINER predicates use owner-only bypass to avoid recursive membership policies. The runtime refuses owner/superuser/BYPASSRLS credentials. This replaces the blanket FORCE-RLS proposal with tested non-owner enforcement.
- Public signup grants only guardian membership after verification. First admin is an explicit one-time owner command; later staff/admins use verified-email-bound, expiring invitations.
- Development uses private local email capture without external delivery or costs. Live SMTP is supported but requires an approved provider and secure configuration before production.
- Domain audit events are persisted for role changes; paid observability/central logging and backups remain inactive scaffolding per user scope.
