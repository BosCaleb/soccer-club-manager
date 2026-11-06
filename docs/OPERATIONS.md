# Deferred operational extension points

Per MVP scope, no scheduled backups, centralised application logs, alerts or restore automation are enabled. Default local runtime stdout and Docker diagnostic output are not a centralised logging system; do not include sensitive values. `/api/health/live` and `/api/health/ready` provide hooks for future monitoring.

| Extension       | Future integration point                                                     | Current state                              |
| --------------- | ---------------------------------------------------------------------------- | ------------------------------------------ |
| Database backup | pg_dump/PITR worker to private SA Blob Storage using managed identity        | Not implemented or scheduled               |
| Restore         | Restore into isolated database, reapply revocations/deletions, verify        | Not implemented/tested                     |
| Central logging | ASP.NET logging providers + regional destination; redacted structured fields | No destination provisioned                 |
| Alerts          | Health probes, database disk, failed outbox delivery, failed backup          | No alerts provisioned                      |
| Audit           | Domain transaction -> append-only audit_events                               | Schema/implementation deferred to features |

Database Docker volume survives ordinary restarts. It is not a backup; removing it or losing its host loses data. Future operational modules must default to off, use an approved SA location and be enabled deliberately after cost review. No claim of recovery capability or production readiness accompanies the P0 scaffold.
