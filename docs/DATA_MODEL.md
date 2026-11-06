# Schema design for P1 onwards

Use UUIDs, UTC instants, DOB as a date, explicit constraints and indexes. Store club_id on scoped entities; composite keys/FKs prevent cross-club references. Migrations run with a separate owner role. Application connections use a least-privilege non-owner role and transaction-local actor context for RLS.

Proposed relationships:

- clubs → seasons → teams; adult accounts → profiles → club_memberships (multiple scoped roles allowed).
- team_staff ties current staff membership to a team and effective dates.
- registration_applications are owned by the submitting guardian and remain visible to that adult while pending. Only explicit verification produces player_guardians access to a player. A second adult must be separately approved.
- players → team_players stores joined/left effective dates. Keep history after transfer. Unapproved players cannot join active rosters.
- consent_records retain notice version, purpose, actor and revocation; privacy basis and retention need club review.
- fixtures have valid lifecycle transitions, monotonically increasing revisions and response deadlines. Eligibility snapshots/temporal queries preserve historical rosters while current access checks govern visibility.
- fixture_availability unique(fixture_id, player_id), includes actor, timestamp and confirmed fixture revision. Material changes require reconfirmation. No row means no response, not unsure. Latest authorised committed response wins; staff override requires a reason.
- squad_draft_entries are editable. squad_publications and squad_publication_entries are immutable snapshots; a current-publication pointer advances atomically. Guardians see only their own child's published outcome.
- announcements have club/team scope and draft/published states. notifications belong to exactly one adult recipient.
- notification_outbox has a unique event/aggregate/revision/recipient key and durable worker claims. Retry with provider idempotency where supported; do not promise exactly-once SMTP.
- audit_events record actor/action/entity and redacted metadata inside the domain transaction. No child DOB, raw notes, tokens or passwords in audit payloads.

No migrations, Identity tables or business records are created in P0. This design intentionally resolves ambiguities before implementation.

## P1 implementation status

Identity tables, `club.clubs`, `club.memberships`, `club.teams`, `club.team_staff`, `club.invitations` and append-only-for-runtime `club.audit_events` now exist in versioned migrations. Account profile fields live on the Identity user. Team CRUD/season history remain P3; other entities above remain P2 onward. Runtime RLS uses transaction-local actor/MFA context. Owner-only fixed definer functions resolve membership recursion; do not enable FORCE RLS without revisiting those predicates.
