# Open issues / next phases

- P1 is implemented and tested locally. SMTP provider/sender, real delivery, production HTTPS, regional Azure SKU/quota/cost verification and privacy approval remain outstanding deployment configuration.
- P2: child applications, consent, admin approval and verified guardian links. Adult account creation alone never establishes guardianship.
- P3: season/team setup UI, roster assignments and effective membership history. P1 contains team-scope primitives and read-only access checks, tested with isolated synthetic teams.
- P4–P7: persistent fixtures, deadlines, availability, versioned squads and durable email outbox. P0 preview actions are not acceptance proof for these workflows.
- P1 email sends synchronously; durable retry/outbox delivery is deferred. Local capture contains private bearer links and must remain outside web roots and Git.
- A self-service or operator-assisted MFA reset/recovery workflow beyond saved one-use codes is not included. No unauthenticated MFA bypass exists.
- No production children, full 100-player seed, offline service worker, backups, alerts or central log sink. Domain role-change auditing is stored in PostgreSQL.
- Fixed November 2026 preview dates and demo role switches are confined to `/preview`; real sessions use `/app`.
- Human club UX review, real-device review and full accessibility certification remain pending. Automated checks are not certification.
- Deployment must use a trusted proxy configuration if individual-IP rate limits are needed; no untrusted forwarding headers are accepted by default.
