# Privacy boundary

P0 uses fictional names and example.test addresses. Do not enter real children or adults into the demo. Nothing in the UI is a live registration or notification. Demo state resets on reload and is not stored in browser localStorage or the backend.

South Africa North is the proposed data region. Azure service choice alone does not prove residency. Review regional product availability, identity/email geography and provider terms before real processing. Email may cross borders, including recipient mailbox hosting; exceptions require explicit approval.

Before accepting real children: establish the club's responsible-party/operator roles, competent-person authority and applicable POPIA processing basis; review the privacy notice, consent, access/correction/deletion and retention; minimise data; verify guardian relationships. Exclude ID numbers, medical details, photos and public rosters.

Backups and centralised logging are deferred per user scope. Audit trail requirements belong to business features, not telemetry. State the recovery limitations explicitly when launching a later pilot. Infrastructure-only health probes do not contain personal data.

## P1 account boundary

`/app` now stores adult account name, email, password hash, adulthood attestation timestamp, security-token state and club memberships. It does not store child records. Use synthetic adults until the club's notice/processing basis and deployment are reviewed. `/preview` remains fictional and in-memory. Local mail files contain private confirmation/reset/invitation links and are not web accessible. Authentication exceptions and accounts never enter centralized logs; role changes produce scoped database audit events. Live SMTP handling remains subject to provider/transfer review.
