# StatEdge Club Manager — build phases and progress

**Updated:** 6 November 2026

**Repository:** BosCaleb/soccer-club-manager

**Current milestone:** P0 and P1 implemented and validated locally. P2 is next.

**Production status:** Not deployed; live email and Azure configuration are still outstanding.

This is the project’s phase-by-phase delivery tracker. Update it when a phase is completed or its scope changes. Detailed evidence lives in [phase reports](phase-reports/); unresolved items live in [OPEN_ISSUES.md](OPEN_ISSUES.md).

## Agreed scope and constraints

- One South African youth/community club initially, with multiple teams, seasons and adult roles. Design data boundaries for future clubs without building self-service multi-club onboarding yet.
- Adult accounts only. Children have player records, not logins. Collect no medical details, national ID numbers, photographs or home addresses in the MVP.
- React/TypeScript/Vite frontend, ASP.NET Core Identity/backend and PostgreSQL. This supersedes the original handover’s Azure + Supabase implementation choice.
- Application data stays in South Africa; target Azure South Africa North, subject to service availability. Any identity/email processing exception requires explicit review. Display times in `Africa/Johannesburg` and reserve ZAR for later finance features.
- Use free tiers and credits where suitable. Check eligibility, regional availability and cost after credits; never silently choose an overseas data region to obtain a free tier.
- **Backups, centralised logs and alerting are scaffolding only for this MVP**, as requested. Do not provision paid operational services automatically. Keep required business audit records in the application database.
- Mobile-first, accessible, interactive UI with restrained animation/transitions and reduced-motion support. Preserve clear loading, empty, error and success states.
- Use synthetic data until real-data processing and the pilot are approved.

## Progress at a glance

| Phase | Deliverable                                   | Status               | What is already available                                                       | Main work remaining                                                             |
| ----- | --------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| P0    | Architecture, UI and development foundation   | Complete locally     | Interactive preview, responsive design, API/database scaffold, CI and docs      | Human UX review; later production hosting selection                             |
| P1    | Adult identity and access control             | Complete locally     | Verified accounts, sessions, MFA, staff invitations, memberships, RLS and audit | Live SMTP and deployment configuration                                          |
| P2    | Child registration and approval               | Not started          | Identity/membership foundation; synthetic child cards                           | Real applications, consent, guardian links, approval and denial tests           |
| P3    | Seasons, teams and assignments                | Foundation only      | Team-scope tables/read endpoints and denial tests                               | Team/season CRUD, staff/player assignment and temporal rosters                  |
| P4    | Fixture lifecycle                             | Preview only         | Fictional fixture cards/details/form                                            | Persisted lifecycle, revisions, scoped visibility and transactional events      |
| P5    | Player availability                           | Preview only         | Child-specific demo response buttons                                            | Real responses, eligibility, deadlines, concurrency and staff summaries         |
| P6    | Matchday squad publication                    | Preview only         | Separate per-fixture draft/published demo states                                | Immutable publications, eligibility rules, private outcomes and notices         |
| P7    | Announcements and notifications               | Foundation + preview | Local account email flows, SMTP adapter, fictional news/inbox                   | Persistent feeds, inbox, durable outbox, retries and validated delivery         |
| P8    | Hardening, Azure deployment and pilot release | Not started          | Local checks, CI workflow, deployment/operations notes                          | End-to-end release validation, regional hosting, live sender and pilot sign-off |

**Status definitions:** “Complete locally” means the phase’s implementation and local checks passed, not that it is deployed. “Preview only” means fictional browser state that resets on refresh. “Foundation” identifies reusable primitives without claiming the whole feature is delivered.

## P0 — Architecture and development foundation

**Goal:** Establish a coherent project, mobile design and repeatable development workflow.

### Done

- [x] React + TypeScript + Vite project, supported Node/.NET toolchains and dependency lockfiles.
- [x] ASP.NET Core API and local PostgreSQL Compose service; genuine database readiness checks.
- [x] Interactive guardian, coach, manager and administrator preview, now isolated at `/preview`.
- [x] Child filters, sample availability, fixtures, squad interaction, notices and notification read state.
- [x] Mobile navigation, CSS motion/transitions, reduced-motion support, keyboard focus and accessibility improvements.
- [x] Domain contracts, architecture decisions, corrected data-model plan, privacy and deployment notes.
- [x] Automated lint/build/unit/browser checks and GitHub Actions configuration.
- [x] Non-provisioning Azure region/settings scaffold and documented operational extension points.

### Remaining follow-through

- [ ] Review the user experience with a guardian and coach, and record feedback as implementation proceeds.
- [ ] Verify actual Azure free-tier/SKU options before provisioning in P8.

**Acceptance evidence:** P0 passed local builds, API/database checks, two unit tests and ten desktop/mobile browser tests. P1 expanded the current browser suite to fourteen. See [P0 report](phase-reports/P0.md).

## P1 — Adult accounts, roles and access control

**Goal:** Replace demo identity with authenticated adult accounts and enforced permissions.

### Done

- [x] Adult registration with attestation, email verification/resend, login/logout and password reset.
- [x] Persisted profile, strong-password rules, rate limiting and failed-password lockout.
- [x] HttpOnly cookie sessions, CSRF protection and security-stamp validation on authenticated requests.
- [x] Password reset/logout invalidate existing sessions; no browser localStorage bearer tokens.
- [x] Authenticator MFA, one-use recovery codes and MFA requirements for staff actions.
- [x] Pilot club and multi-role memberships; no public self-assignment of staff roles.
- [x] Protected one-time administrator bootstrap for an already-verified adult.
- [x] Admin-issued, expiring, verified-email-bound staff invitations; single-use acceptance and revocation.
- [x] Immediate membership revocation with last-admin protection and role-change audit records.
- [x] Separate owner/migration and restricted runtime database credentials.
- [x] Domain row-level policies and explicit grants; current role/team checks, transaction-local context and runtime privilege guard.
- [x] Real `/app` home/account/staff screens; synthetic role switching remains confined to `/preview`.
- [x] Private development mail capture and SMTP adapter with required STARTTLS.
- [x] Versioned Identity/domain migrations, migration repeatability and documented operator instructions.

### Remaining deployment dependencies

- [ ] Choose/review a live email provider and sender; configure credentials securely and validate real delivery.
- [ ] Configure HTTPS origin, persistent protected Data Protection keys and regional runtime database/hosting.
- [ ] Design an audited operator recovery process for users who lose both authenticator access and recovery codes, if required for the pilot.

**Acceptance evidence:** 112 HTTP/database security assertions, fourteen desktop/mobile browser tests, two unit tests, builds, lint and format checks passed. These include forged-role denial, MFA, invitation expiry/replay, cross-team/club denial, reset/session invalidation and runtime credential refusal. SMTP delivery and Azure deployment were not tested. See [P1 report](phase-reports/P1.md) and [authentication operations](AUTHENTICATION.md).

## P2 — Child registration, consent and approval

**Goal:** A verified adult submits a child application; an administrator reviews it and verifies authorised guardian access.

### Already available

- [x] Real adult identities, verified email, scoped club memberships and admin/MFA enforcement.
- [x] Proposed application/link/consent contracts and synthetic child-card designs.

### To implement

- [ ] Migrations for registration applications, players, verified guardian links and purpose-specific consent records.
- [ ] A submitter-owned pending application, visible before a verified child relationship exists.
- [ ] Minimal child form: name, date of birth, relationship, optional requested age group and reviewed notice/consent.
- [ ] Persist pending/approved/rejected/inactive states; show clear guardian status and safe rejection explanations.
- [ ] Admin review queue, explicit approve/reject actions and redacted audit reasons.
- [ ] Sibling support and separately approved invitations/linking for a second guardian.
- [ ] Prevent discovery or linking of an existing child by knowing their name or UUID.
- [ ] Server validation, duplicate-submission protection and database grants/policies.
- [ ] Consent revocation and access/correction/deletion request entry points appropriate to this phase.

**Required checks:** Registration persists across reload/login; one adult can submit two children; pending applications are private; another family cannot read/change a child through URL/API manipulation; a second guardian gains access only after verification; role/status/link fields cannot be forged.

**Dependencies:** Club-reviewed notice, processing basis, competent-person/guardian verification approach and privacy contact before using real records. Registration approval and team assignment remain distinct.

## P3 — Seasons, teams, staff and player assignments

**Goal:** Administrators organise teams; staff see only authorised rosters.

### Already available

- [x] Team/team-staff scope primitives, read endpoints and cross-team denial tests from P1.
- [x] Real staff memberships/invitations and synthetic team screens.

### To implement

- [ ] Season dates, configurable age-cutoff rules and team configuration migrations.
- [ ] Admin season/team creation, editing and archiving screens.
- [ ] Team-scoped coach/manager assignment using active club memberships.
- [ ] Approved-player assignment and effective joined/left membership dates.
- [ ] Multi-team support, transfers and historical memberships without duplicating player identities.
- [ ] Staff roster/dashboard with minimal fields; guardians see only their linked child’s memberships.
- [ ] Immediate access changes after staff/player removal and explicit future-fixture eligibility rules.
- [ ] Foreign-key/constraint enforcement for club-consistent relationships.

**Required checks:** Unapproved players cannot join active rosters; unrelated staff cannot access another team; guardians cannot retrieve full private rosters; transfers preserve history; configurable season/age rules work without a hard-coded national cutoff.

## P4 — Fixture creation, publication and changes

**Goal:** Authorised staff publish reliable, private team schedules.

### Already available

- [x] Synthetic fixture cards, details, form and SAST display helpers.
- [x] Fixture status/revision contracts and staff identity foundation.

### To implement

- [ ] Persist fixtures, meeting/kickoff times, venue, home/away status and response deadlines.
- [ ] Valid transitions: draft, published, postponed, cancelled and completed.
- [ ] Explicit publish/reschedule/cancel operations; monotonic revisions and stale-edit conflicts.
- [ ] Guardian visibility limited to published fixtures for eligible linked children.
- [ ] Define historical/effective eligibility and notification recipients when players transfer teams.
- [ ] Transactional, uniquely keyed notification-outbox events on publication/material changes.
- [ ] Clearly label cancellations/postponements and preserve history.

**Required checks:** Draft secrecy; team/club denial; invalid date combinations rejected; one publication event per revision; concurrent edits handled; cancellation closes guardian response paths; stored UTC renders correctly in SAST.

## P5 — Guardian availability and staff summaries

**Goal:** Guardians respond per child; coaches receive accurate, current counts.

### Already available

- [x] Accessible demo Available / Can’t make it / Unsure buttons and sibling filters.
- [x] Canonical response types and planned revision-aware response model.

### To implement

- [ ] Persist one availability record per fixture/player; absence of a record means no response.
- [ ] Authorise mutations using current verified guardian links and player eligibility.
- [ ] Enforce fixture status and response deadline on the server.
- [ ] Allow authorised staff override only with a recorded reason and audit actor.
- [ ] Define atomic last-authorised-write behaviour for two guardians and duplicate requests.
- [ ] Record the confirmed fixture revision; material changes require reconfirmation.
- [ ] Team-scoped counts and lists for available/unavailable/unsure/no response/reconfirmation.
- [ ] Display clear saved, locked, stale and failed-network states without pretending an unsaved answer succeeded.

**Required checks:** Sibling independence; either verified guardian can respond; latest committed response wins; deadline/cancellation/transfer restrictions cannot be bypassed; summaries match the eligible roster; unrelated-family requests are denied.

## P6 — Matchday squad selection and publication

**Goal:** Coaches publish child-specific squad outcomes independently of availability.

### Already available

- [x] Demo per-fixture draft editing/publication interaction.
- [x] Selection types and immutable-publication design decision.

### To implement

- [ ] Editable squad drafts plus immutable published versions and publication entries.
- [ ] Coach/admin editing and explicit publication; managers remain read-only by default.
- [ ] Eligible-roster/availability view; block selecting unavailable players by default.
- [ ] Selected/reserve/not-selected outcomes; guardians see only their own child’s published outcome.
- [ ] Editing a new draft leaves the current published version unchanged.
- [ ] Publication revision, atomic snapshot/current-version update and targeted notification events.

**Required checks:** Draft secrecy, no cross-child roster disclosure, coach/team denial, manager edit denial, unavailable-selection rule, publication idempotency and correct notification recipients after revision.

## P7 — Announcements, inbox and reliable notifications

**Goal:** Club information reaches the correct adults, with persistent in-app notices and reliable critical email.

### Already available

- [x] Fictional club-news/inbox UI and read-state interaction.
- [x] Account email adapter and verified-address foundation from P1.
- [x] Planned notification/outbox contracts; private local mail tests.

### To implement

- [ ] Scoped club/team announcement drafts, publication and feeds.
- [ ] Persistent per-recipient inbox and read/unread state with authorised deep links.
- [ ] Durable outbox dispatcher with claims, bounded retries, backoff and safe failed-send diagnostics.
- [ ] Unique event/revision/recipient keys; provider idempotency or reconciliation where available.
- [ ] Recheck current access before dispatch, skipping revoked/ineligible recipients.
- [ ] Critical fixture publish/reschedule/cancellation and squad publication templates.
- [ ] Manual reminders to pending guardians and appropriate optional-mail preferences.
- [ ] Verified sender setup, SPF/DKIM/DMARC guidance and actual delivery/failure tests.
- [ ] Minimise email content; keep child details out of subjects, message bodies and public URLs.

**Required checks:** Correct recipients only; no cross-team feed leakage; inbox works when email fails; retry/deduplication behaviour is proven; revoked guardians are skipped. Do not promise exactly-once SMTP delivery. A full MVP requires a validated critical email path.

## P8 — Hardening, Azure deployment and pilot release

**Goal:** A usable, tested restricted pilot hosted within the agreed residency/cost constraints.

### Already available

- [x] Local CI-style checks, security tests and frontend/API builds.
- [x] Deployment, privacy, identity and operations documentation.
- [x] South Africa North settings scaffold with no provisioned resources.

### To implement / verify

- [ ] Run the complete adult → child application → admin → team → fixture → availability → squad → notification journey.
- [ ] Seed at least five teams, 100 synthetic players and 100 synthetic adult accounts for integration testing.
- [ ] Expand allow/deny tests across all endpoints, roles, children, clubs, transfers and revocations.
- [ ] Review real phones, 360px layouts, keyboard/screen-reader use, slow connections and failure states.
- [ ] Add installable PWA basics and an offline static shell only; no cached private records or offline mutation sync.
- [ ] Verify actual South African Azure SKU/free-tier availability, subscription quotas and full cost after credits.
- [ ] Select and provision the approved regional UI/API/database arrangement; enforce same-origin HTTPS and private database access.
- [ ] Configure production identity keys, SMTP sender, allowed origins and trusted proxy settings securely.
- [ ] Validate actual deployment URL, direct SPA route refreshes, API behaviour, migrations and code rollback.
- [ ] Finish privacy notice/basis/retention/request procedures, responsible-party/operator roles, support owner and email-transfer review.
- [ ] Record the MVP’s deferred backup/monitoring limitations and the hooks for enabling them later. **Do not make paid backup/logging services or a restore drill a new MVP requirement.**
- [ ] Obtain club/technical pilot sign-off, operator guide and known-limitations register before real minor records.

**Required checks:** Full workflow and negative access matrix pass on the deployed system; real critical email works; region and cost choices are verified; no secrets are in the client or source; mobile flows are reviewed. Local test results and a saved configuration are not proof of deployment.

## Deferred operational work

The following stay outside the current MVP implementation unless requested: scheduled database backups/PITR, automated restore drills, centralised telemetry, alerting and multi-region/high-availability infrastructure. Their integration points are documented in [OPERATIONS.md](OPERATIONS.md). A database volume surviving a restart is not a backup, and no recovery capability is currently claimed.

Domain audit events, authentication protections and permission-denial tests remain part of the product because they enforce and explain access to club data.

## After the MVP

| Release | Candidate scope — not yet implemented                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------ |
| 1.1     | Recurring training, attendance, calendar subscriptions, jersey numbers, Afrikaans and reminder preferences         |
| 1.2     | Match results/standings, transport coordination, carefully approved private uploads, imports/exports and reporting |
| 2.0     | Self-service multi-club SaaS onboarding, branding, billing and documented tournament-manager integration           |
| Later   | Finance, equipment, sponsorship, analytics and other separately approved modules                                   |

Payments, child chat, public youth directories, medical records, location tracking, AI player assessment and native mobile apps remain outside this MVP.

## How to update progress

1. Mark an implementation item complete only when it exists and its applicable checks pass.
2. Keep local, live-provider and deployed evidence separate; record skipped/unrun checks honestly.
3. Save a phase report under `docs/phase-reports/P#.md` with files/migrations, test results, manual configuration and limitations.
4. Update this document, [OPEN_ISSUES.md](OPEN_ISSUES.md) and [DECISIONS.md](DECISIONS.md) together when scope/status changes.
5. Start P2 next; do not treat the synthetic preview as delivered business functionality.
