# P1 authentication and access control

## Boundaries

ASP.NET Core Identity handles password hashing, confirmation/reset tokens, account lockout, authenticator TOTP and one-use recovery codes. PostgreSQL persists accounts. Public registration explicitly accepts only name/email/password/adult attestation; unknown JSON fields such as `role` are rejected. Email verification activates only the pilot-club guardian membership. Email verification/attestation is not proof of guardianship; P2 supplies that workflow.

Authentication uses HttpOnly, SameSite=Strict cookies. Secure is mandatory outside Development. Sessions expire after eight hours without sliding renewal. Every authenticated request revalidates the security stamp; password resets and logout revoke existing sessions. Authenticator setup refreshes the session after key creation. MFA assurance survives only successful security-stamp validation. Staff actions require the MFA claim AND current database memberships. Identity roles/JWT/browser state are not authoritative for club permissions.

All unsafe `/api` methods validate ASP.NET antiforgery tokens. The browser obtains a fresh token before mutations, including login/logout, to handle principal changes. No CORS permission is enabled. Account actions have a 100-per-minute per-IP fixed-window limiter, and passwords lock out after five failed attempts for 15 minutes. Do not trust arbitrary forwarded-IP headers; deployment must configure only a trusted reverse proxy if individual client-IP rate limiting is required. Behind an unconfigured proxy, requests share its limit. Generic email-request/login responses avoid publishing an account directory.

## Database and migration roles

`manage.py migrate` uses the local owner credential to provision a fixed restricted role and apply two migrations. `dev_api.py` never supplies owner credentials to the web server. `club_app` is NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOINHERIT and NOBYPASSRLS. Startup also refuses superuser, RLS-bypass or domain-table ownership.

Identity tables are accessible only to server-side Identity operations. Domain tables in `club` enforce row-level policies plus explicit grants. No DELETE permission exists on membership data; only status updates are allowed. Audit records allow inserts and scoped admin reads, with no UPDATE/DELETE grant. Teams have read-only grants in P1; management comes in P3.

Small SECURITY DEFINER predicates read current membership/verified-email state with fixed search paths and revoked PUBLIC execution. Owner bypass is intentionally retained for those predicates and management; FORCE RLS is not applied to their source tables because it would make membership predicates recursive. The runtime role owns no schema objects, cannot bypass RLS, and cannot modify function definitions. This is an explicit implementation adjustment to the earlier blanket FORCE-RLS suggestion.

Each request sets actor and MFA context using transaction-local `set_config`. No context persists beyond commit/rollback when connections return to the pool. Identity password-failure counters commit even on 401 responses; exceptions roll back. Business queries also constrain club/team IDs and check current membership. Audit/invitation/membership changes share a transaction. Revocation invalidates permission checks without waiting for cookie expiry. Outstanding invitations for a revoked role are cancelled as well.

## Email and configuration

| Setting                            | Purpose                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `ConnectionStrings__ClubDatabase`  | Runtime application-role connection; never a VITE variable               |
| `ConnectionStrings__AdminDatabase` | Management-only connection; excluded from the serving helper environment |
| `App__KeyDirectory`                | Persistent private Data Protection key directory                         |
| `App__PublicOrigin`                | Fixed origin used for links; HTTPS required in production                |
| `Mail__Mode=Local`                 | Allowed only in Development; writes private JSON messages                |
| `Mail__Directory`                  | Local capture directory, never web-served                                |
| `Smtp__Host`, `Smtp__Port`         | SMTP server and STARTTLS port, default 587                               |
| `Smtp__From`                       | Verified sender address                                                  |
| `Smtp__Username`, `Smtp__Password` | Server-only credentials if authentication is required                    |

Local `.local` directories are private, ignored by Git and contain tokens/keys. Data Protection keys must survive process restarts and be protected by deployment filesystem access and encrypted storage. Production key-encryption and storage arrangements require deployment review; the MVP does not provision Key Vault. Do not remove keys as a troubleshooting shortcut: that invalidates sessions and outstanding links.

SMTP uses required STARTTLS and normal certificate validation. Its actual provider, credentials and cross-border exception are still unselected. Local email capture was tested; live SMTP was not. Verification/reset links expire after one hour; invitation links after 48 hours. Invitation tokens are random 256-bit values and only SHA-256 hashes are stored in domain tables. Verification/reset links become invalid after successful use/state change.

Email is synchronous in P1: a delivery failure returns a generic service error and rolls back account/invitation changes. An SMTP acceptance followed by a later database failure can leave an unusable email; retrying through the account flow is the recovery. Durable background email/outbox delivery remains P7. No mail tracking or child details are sent. Recipient mailbox geography and provider terms still need review.

## Operator steps

- Bootstrap only a designated, already-verified adult using `manage.py bootstrap-admin EMAIL`; further admins use MFA-authorised invitations.
- Keep recovery codes offline; they are shown once and consumed on use. P1 has no public MFA-disable/reset backdoor. Lost authenticator plus lost recovery codes needs an audited future operator recovery procedure; do not bypass MFA via UI flags.
- No real child data is handled in P1. Production SMTP, HTTPS hosting, residency review and club privacy approval remain deployment prerequisites.
- Keep the synthetic `/preview` separate from `/app`. Its role picker controls only fictional UI state and cannot grant database access.
