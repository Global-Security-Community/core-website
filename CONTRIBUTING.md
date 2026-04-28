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

Merge `main` into `live-version-swa` to deploy:

```bash
git checkout live-version-swa
git merge main
git push origin live-version-swa
git checkout main
```

## Tests

```bash
cd api && npm test          # Jest (API unit tests)
npm run test:e2e            # Playwright (E2E, requires SWA running)
```
