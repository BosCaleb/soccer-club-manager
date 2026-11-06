# StatEdge Club Manager

A mobile-first South African football club application. **P1 implements real adult accounts and scoped club access.** Child registration and football workflows are subsequent phases.

See the [build roadmap and phase tracker](docs/BUILD_ROADMAP.md) for all phases, completed work, remaining tasks and acceptance checks.

- `/register`, `/login`: adult sign-up, verified email and cookie sessions.
- `/app`: authenticated home using current database memberships.
- `/app/account`: persisted profile and authenticator/recovery-code setup.
- `/app/staff`: MFA-protected administrator invitations and revocation.
- `/preview`: the separate P0 synthetic football UI. Its role picker never grants real access; preview edits reset on reload.

## Start development

Requirements: Node 24, .NET 10 SDK, Python 3, Docker/Compose. Use the existing checkout in managed cloud tasks; do not create a worktree unless requested.

```sh
npm ci
# On a fresh checkout only; preserve an existing .env.
cp .env.example .env
# Replace POSTGRES_PASSWORD with a unique local development password.
docker compose up -d --wait
dotnet restore server/ClubManager.Api --locked-mode
dotnet build server/ClubManager.Api --no-restore
python3 scripts/manage.py migrate
python3 scripts/dev_api.py
# In another terminal:
npm run dev
```

API: loopback port 5080. UI: port 5173 with same-origin `/api` proxy. The migration command uses owner credentials; the running API uses the restricted `club_app` role and refuses privileged credentials. `.local/application-password` is generated privately and reused; do not delete or commit it. `.local/keys` retains Data Protection keys across restarts. Missing schema, insecure database role or missing runtime configuration prevents startup; temporary database failure causes readiness to fail.

On this cloud machine, prepend `/workspace/.tools/dotnet` to PATH or set `DOTNET_COMMAND=/workspace/.tools/dotnet/dotnet` for the Python helpers. The local helper supplies Development settings and a private local mail directory. No real email is sent in this mode.

## Verify an account and bootstrap the first admin

1. Register a **synthetic adult** in the UI, affirming adulthood.
2. Open the matching message in the private `.local/mail/` directory locally. Follow its verification link, then sign in. These files contain bearer links: do not share or commit them. Use a consistent browser origin; the default links use localhost port 5173. Set `App__PublicOrigin` for a different local origin.
3. The designated first administrator must already have verified their email. Run the owner-only command:

```sh
python3 scripts/manage.py bootstrap-admin verified-adult@example.test
```

Bootstrap closes once an active administrator exists. It is never a public signup option. Go to Account, confirm the password, enter the setup key in an authenticator, and verify a TOTP code. Save the eight one-use recovery codes privately. Admin/staff actions require MFA assurance; a password-only session cannot manage staff.

An administrator can invite a coach, manager or additional administrator. The recipient registers/verifies the exact invited email, opens their invitation link, accepts it, and enables MFA. Reopen the original invitation after registration if needed. Invitations expire after 48 hours and are single-use. Revoking a role immediately removes its backend permissions; the last administrator cannot be removed through the API.

## Verify the build

```sh
npm run format:check
npm run lint
npm run build
npm test
python3 scripts/test_p1.py
npx playwright install chromium
npm run test:e2e
```

`test_p1.py` creates a unique temporary database, exercises real accounts and direct RLS/grant denial checks, and drops only that test database in a finally block. It uses the local Compose PostgreSQL; hosted CI supplies `P1_POSTGRES_CONTAINER` for its service container. It leaves private test mail/key artifacts under `.local/`, never in Git.

Browser tests include synthetic account creation, verification, login, reload persistence, profile edit and logout at desktop and 360px widths, plus P0 preview regression and accessibility checks. With a preinstalled Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Playwright starts API/UI if absent; run migrations first. Tests only use synthetic accounts.

## Production configuration and cost

No Azure resources have been provisioned or published. Prefer eligible free tiers/credits in South Africa; never silently move data overseas to obtain a free tier. Backups, centralised logs and alerts remain scaffolding only. Role-change audit records are ordinary database records and require no separate paid service.

Before production, configure a reviewed SMTP provider, fixed HTTPS `App__PublicOrigin`, persistent protected Data Protection keys, least-privilege database credentials and a regional host. Production rejects local email capture and insecure public origins. No live SMTP delivery, regional deployment, legal sign-off or restore capability is claimed. See [authentication operations](docs/AUTHENTICATION.md), [API contracts](docs/API_CONTRACT.md), [decisions](docs/DECISIONS.md), and [phase reports](docs/phase-reports/).
