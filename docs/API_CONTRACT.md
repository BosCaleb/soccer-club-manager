# API contracts — P1

Every unsafe API request requires `X-CSRF-TOKEN`, obtained with same-origin cookies from `GET /api/auth/csrf`. Authentication uses a server cookie, never a browser-stored bearer token. Unmapped request fields are rejected. Server derives actor IDs from the authenticated principal.

| Method/path                                     | Behaviour                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| GET /api/health/live, /api/health/ready         | Process health / real database query                                       |
| GET /api/auth/csrf                              | Antiforgery request token and HttpOnly cookie                              |
| POST /api/auth/register                         | Adult attestation, email, displayName, strong password; no roles           |
| POST /api/auth/verify-email                     | userId + token; activate guardian membership once                          |
| POST /api/auth/resend-verification              | Generic response for eligible email requests                               |
| POST /api/auth/login                            | email/password; returns requiresTwoFactor or sets session                  |
| POST /api/auth/login/mfa                        | Pending login plus code; recovery=true selects one-use recovery code       |
| POST /api/auth/forgot-password, /reset-password | Generic request; token-based reset invalidates sessions                    |
| GET /api/auth/me                                | Own profile, email verification, MFA assurance and current memberships     |
| POST /api/auth/profile                          | Own displayName only                                                       |
| POST /api/auth/logout                           | Invalidates all existing sessions for that account                         |
| POST /api/auth/mfa/setup                        | Password recheck; setup key only for an authenticated non-enrolled account |
| POST /api/auth/mfa/enable                       | Valid TOTP; enables MFA and returns eight recovery codes once              |
| GET /api/clubs/:club/members                    | Current MFA-verified admin only                                            |
| GET /api/clubs/:club/audit                      | Last 100 redacted role-change audit events, admin only                     |
| GET /api/clubs/:club/teams[/:team]              | Current assigned MFA staff or club admin; foreign team 404                 |
| POST/GET /api/clubs/:club/invitations           | Admin issues/lists staff invitations                                       |
| DELETE /api/clubs/:club/invitations/:id         | Admin revokes pending invitation                                           |
| POST /api/invitations/accept                    | Matching verified recipient, valid single-use token                        |
| DELETE /api/clubs/:club/members/:user/:role     | Admin revokes active role; cannot remove last admin                        |

Statuses: 400 invalid/CSRF, 401 unauthenticated or failed sign-in, 403 forbidden/MFA missing, 404 non-disclosing missing entity, 409 duplicate pending invitation or last-admin conflict, 429 rate limited, 503 service/database/mail failure. Readiness success does not establish live-email or production readiness.

Sessions intentionally expose no generic user lookup, user role mutation, child records or unrestricted roster. Planned registration/fixture/squad/outbox commands are documented in DATA_MODEL.md. Frontend TypeScript domain types remain under `src/lib`; generated API schema is future work.
