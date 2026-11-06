# Deployment and cost scaffold

No Azure deployment, environment-draft changes or publication was performed for P0.

Prefer free allowances where they meet the workload and South African residency requirement. Check actual subscription eligibility, service availability, normal cost after credits, resource quotas, and idle/expiry behaviour before selecting a SKU. Do not silently switch to an overseas database because it is free.

Candidate paths to price in P1/P8:

1. Eligible regional App Service or Container Apps allowance plus eligible regional PostgreSQL offer, if available and appropriate.
2. A small regional Linux VM running API/UI and PostgreSQL if it has lower total cost; technical owner accepts patching and single-instance operations.
3. If neither fits a zero budget, retain the local demo until hosting budget/credits exist.

Runtime target: same-origin HTTPS UI and `/api` reverse proxy, with Vite `dist` served statically and SPA fallback for `/app/*`. Never rewrite `/api/*` into HTML. PostgreSQL stays on a private/loopback network. CI runs tests before deployment; production release workflow is intentionally deferred until hosting is selected. No unused paid Key Vault, monitoring workspace, storage account, WAF or backup service is created by this repository.

Region target is `southafricanorth`; verify regional service SKUs first. No global CDN or real-data developer previews by default. Identity records will use regional ASP.NET Identity storage. External email provider remains unselected. Use workload identity for deployment and managed identity for future Azure services where supported; never browser-shipped server secrets.

Use `infra/main.bicep` as a non-provisioning settings scaffold, not an application deployment. Future modules must be added explicitly after cost/residency review. Budgets alert but do not enforce a hard Azure spending cap. Free-tier constraints and lack of configured backups must be documented before a real-user release.

## P1 runtime preparation

Apply migrations using a management-only identity, then serve using the restricted application role. See AUTHENTICATION.md for cookie/CSRF, persistent Data Protection keys, fixed public HTTPS origin and SMTP settings. Startup rejects privileged runtime DB roles and rejects local email mode outside Development. Serving a static `dist` directory alone no longer provides the real app: `/api` must reach the ASP.NET backend under the same origin. The `/preview` route remains a synthetic UI only.
