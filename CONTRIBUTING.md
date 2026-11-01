# Contributing to the Global Security Community Website

## Quick Start

```bash
nvm install 22 && nvm use 22       # Node 22.12+ required
npm install && cd api && npm install && cd ..
npx @11ty/eleventy                  # Build static site
npx swa start _site --api-location api  # http://localhost:4280
```

## Adding a New API Function

**Three files must be updated — missing any one will cause the function to silently fail.**

| Step | File | What to do |
|------|------|------------|
| 1 | `api/src/functions/<name>.js` | Create handler, export with `module.exports` |
| 2 | `api/src/app.js` | Import and register with `app.post()` / `app.get()` / `app.http()` |
| 3 | `staticwebapp.config.json` | Add route with `allowedRoles` (above the `"/api/*"` catch-all) |

For admin functions, also add `logAudit()` for audit trail and wrap with `withCsrf()` in `app.js`.

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for detailed conventions and examples.

## Key Conventions

- **Sanitisation:** Use `sanitiseFields()` for plain text, `sanitiseRichText()` for rich HTML (event descriptions)
- **Events:** Single-date model (no start/end date range)
- **Rich text:** Quill.js editor on dashboard; HTML sanitised server-side via `sanitize-html`
- **Audit logging:** All admin actions logged via `logAudit()` (fire-and-forget)

## Dependency Maintenance

Dependabot groups npm security fixes across the root and API lockfiles. Verified patch/minor
security updates can auto-merge into `main` only after the required CI and CodeQL checks pass.
Major updates and GitHub Actions updates require manual handling; alerts are not auto-dismissed.

Keep CodeQL's `init`, `autobuild`, and `analyze` actions pinned to the same release commit.
Dependabot groups their version and security updates so a pull request updates them together,
avoiding incompatible mixed action versions. Production dependency fixes still require the
separate release process below.

## Deployment

Run the production release workflow when the tested changes on `main` are ready:

```bash
gh workflow run release-production.yml
```

The workflow opens a pull request from `main` into `live-version-swa` and enables merge-commit
auto-merge. GitHub releases it after the required source, CI, CodeQL, and deployment-preview
checks pass. New events and approved chapters use isolated automated releases: each generated page is squash-merged into
`main`, copied alone into a protected production pull request, and deployed after all required
checks pass. Event publication also verifies the live page's event-specific content before
marking it published and emailing chapter subscribers. The manual workflow remains available
for code changes and other releases.

Deploy the complete event-publication change through the normal `main` to `live-version-swa`
release before relying on event-only releases: production needs both the callback API and the
updated source validator. Legacy dispatches without tracking fields continue generating on
`main` and explicitly require a normal release during rollout.

Event callbacks use the existing `APPROVAL_TOKEN_SECRET` in SWA settings, scoped to one event,
chapter, and publication attempt; callback tokens are masked before entering workflow logs.
No new shared secret is required. Failed or stalled event
publication can be retried from the dashboard without creating a duplicate event. Only a
verified deployment sends subscriber notifications; replayed callbacks do not resend them.

## Tests

```bash
cd api && npm test          # Jest (API unit tests)
npm run test:e2e            # Playwright (E2E, requires SWA running)
```

Publication regression tests use mocked API/auth routes and the real built dashboard, so they
do not require SWA or send real emails:

```bash
npm run build && npx playwright test e2e/event-publication.spec.js
```
