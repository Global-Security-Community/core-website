# Contributing to the Global Security Community Website

## Quick Start

```bash
# Frontend (Eleventy dev server)
npm install && npm start        # http://localhost:8080

# API (Azure Functions)
cd api && npm install && npm start  # http://localhost:7071
```

## Adding a New API Function

**Three files must be updated — missing any one will cause the function to silently fail.**

| Step | File | What to do |
|------|------|------------|
| 1 | `api/src/functions/<name>.js` | Create handler, export with `module.exports` |
| 2 | `api/src/app.js` | Import and register with `app.post()` / `app.get()` / `app.http()` |
| 3 | `staticwebapp.config.json` | Add route with `allowedRoles` (above the `"/api/*"` catch-all) |

See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) for detailed conventions and examples.

## Deployment

Always push to both branches:

```bash
git push origin main && git push origin main:live-version-swa
```

## Tests

```bash
cd api && npm test
```
