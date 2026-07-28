# Contributing to the Global Security Community Website

## Quick Start

```bash
nvm use 22                          # Node 22 required
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

## Deployment

Run the production release workflow when the tested changes on `main` are ready:

```bash
gh workflow run release-production.yml
```

The workflow opens a pull request from `main` into `live-version-swa` and enables merge-commit
auto-merge. GitHub releases it after the required source, CI, CodeQL, and deployment-preview
checks pass. Generated event and chapter pages use squash auto-merge into `main` but remain
unreleased until approved. New chapter generation posts a Discord approval link bound to the
exact tested `main` commit. An authenticated administrator can approve that release; if `main`
changes first, the approval expires and the release is blocked. The manual workflow remains
available for non-chapter releases.

## Tests

```bash
cd api && npm test          # Jest (API unit tests)
npm run test:e2e            # Playwright (E2E, requires SWA running)
```
