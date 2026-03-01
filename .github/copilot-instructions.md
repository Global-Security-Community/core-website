# Copilot Instructions — Global Security Community (GSC)

This file defines project conventions and standards for AI-assisted development.
Read this before making any changes.

---

## Project Overview

The GSC website is a nonprofit platform connecting cybersecurity professionals through local
chapters and events. It is an **Eleventy 3.1.2** static site hosted on **Azure Static Web Apps**
with **Azure Functions v4** (Node.js, JavaScript) as the API backend, **Azure Table Storage** for
data, **Azure Communication Services** for transactional emails, and a **Discord bot** for
notifications.

**Live domain:** `globalsecurity.community`
**Deployment branch:** `live-version-swa` (always push to both `main` and `main:live-version-swa`)

---

## Architecture

```
core-website/
├── src/                          # Eleventy frontend (Nunjucks + Markdown)
│   ├── _includes/layouts/        # Page layouts (base.njk, event.njk, chapter.njk)
│   ├── css/style.css             # Single stylesheet
│   ├── js/                       # Client-side JavaScript (vanilla, no framework)
│   ├── events/                   # Generated event pages (one folder per event)
│   ├── chapters/                 # Generated chapter pages
│   ├── dashboard/                # Admin dashboard
│   ├── scanner/                  # QR code check-in scanner
│   ├── sw.js                     # Service worker (currently gutted for dev)
│   └── manifest.json             # PWA manifest
├── api/                          # Azure Functions v4 backend
│   ├── src/app.js                # ⚠️ CENTRAL FUNCTION REGISTRY — all functions registered here
│   ├── src/functions/            # One file per API function
│   └── src/helpers/              # Shared utilities (auth, storage, email, etc.)
├── staticwebapp.config.json      # SWA routing, auth, CSP, headers
├── infra/                        # Bicep IaC templates
├── .github/workflows/            # CI/CD and generation workflows
└── .eleventy.js                  # Eleventy configuration
```

---

## Adding a New API Function

**This is the most important convention in the project.**

Every API function requires changes in **three** places:

### 1. Create the function file — `api/src/functions/<name>.js`

```js
const { getAuthUser, unauthorised } = require('../helpers/auth');
// ... other imports

/**
 * POST /api/<name>
 * Description of what this endpoint does.
 */
async function myFunction(request, context) {
  // ... implementation
  return { status: 200, jsonBody: { success: true } };
}

module.exports = myFunction;
```

**Rules:**
- Export the handler with `module.exports = myFunction`
- Do **NOT** call `app.http()` or `app.post()` inside the function file
- Use `request` and `context` parameters (Azure Functions v4 model)
- Return response objects with `{ status, jsonBody }` or `{ status, body }`
- Never return HTTP 404 from API functions (SWA's `responseOverrides` rewrites 404 → `index.html`)
- Use `getAuthUser(request)` from `../helpers/auth` for authentication
- Use `sanitiseFields()` or `stripHtml()` from `../helpers/sanitise` for user input
- Use helpers from `../helpers/tableStorage` for all storage operations

### 2. Register in the central app — `api/src/app.js`

```js
const myFunctionHandler = require('./functions/myFunction');

// Add to the appropriate section (Public / Auth / Authenticated / Admin)
app.post('myFunction', { authLevel: 'anonymous', handler: myFunctionHandler });
```

**Sections in app.js:**
- **Public endpoints** — no auth required (contactForm, chapterApplication, etc.)
- **Auth: role assignment** — the roles endpoint
- **Authenticated endpoints** — requires `authenticated` role (registerEvent, myTickets, etc.)
- **Admin endpoints** — requires `admin` role (createEvent, checkIn, etc.)

> ⚠️ `authLevel` is always `'anonymous'` because SWA handles auth via `staticwebapp.config.json` routes.

### 3. Add route protection — `staticwebapp.config.json`

```json
{
  "route": "/api/myFunction",
  "allowedRoles": ["authenticated"]
}
```

**Place the route ABOVE the catch-all `"/api/*"` rule.** Role options:
- `"anonymous"` — public (no route entry needed, falls through to catch-all)
- `"authenticated"` — logged-in users
- `"admin"` — admin users only
- `"volunteer"` — event volunteers

---

## Removing an API Function

Reverse the three steps above:
1. Delete the function file from `api/src/functions/`
2. Remove the import and registration from `api/src/app.js`
3. Remove the route entry from `staticwebapp.config.json`

---

## Frontend Conventions

### JavaScript
- **Vanilla JavaScript only** — no frameworks, no build step
- Files live in `src/js/`, one file per page/feature
- Use `fetch('/api/...')` for API calls — SWA proxies automatically
- Auth state is read from `/.auth/me` endpoint
- Include auth-nav.js on every page for consistent login/logout UI

### CSS
- Single file: `src/css/style.css`
- No CSS preprocessors

### Templates
- Eleventy with **Nunjucks** (`.njk`) template engine
- Markdown pages use Nunjucks for expressions
- Layouts in `src/_includes/layouts/` (base.njk, event.njk, chapter.njk)

### Static Assets
- Passthrough-copied via `.eleventy.js`: `src/assets/`, `src/css/`, `src/js/`, `src/manifest.json`, `src/sw.js`

---

## Azure Table Storage Conventions

- All table operations go through `api/src/helpers/tableStorage.js`
- Add new operations as exported functions in that file
- Tables: `Chapters`, `Events`, `EventRegistrations`, `EventDemographics`, `ContactSubmissions`, `ChapterApplications`
- PartitionKey/RowKey patterns vary per table — check existing helpers
- Boolean values from Table Storage can arrive as strings (`"true"`/`"false"`) — always use strict comparison: `=== true || === 'true'`

---

## Email (Azure Communication Services)

- All email functions in `api/src/helpers/emailService.js`
- Sender: `DoNotReply@globalsecurity.community`
- ACS resource: `gsc-core-acs`, Email service: `gsc-core-ces`
- Send emails as non-blocking fire-and-forget (don't fail the parent operation if email fails)

---

## Deployment

- **Frontend:** Eleventy builds to `_site/`, deployed by Azure SWA GitHub Action
- **API:** Azure Functions in `api/` deployed alongside SWA
- **Branches:** Always push to both `main` and `live-version-swa`:
  ```bash
  git push origin main && git push origin main:live-version-swa
  ```
- **Generation workflows** (`generate-event.yml`, `generate-chapter.yml`) create pages via GitHub Actions and push to main — they do `git pull --rebase origin main` before push to avoid conflicts

---

## Authentication & Authorisation

- **Provider:** Azure AD B2C (CIAM) via SWA custom OpenID Connect
- **Tenant:** `c812121a-18f7-492e-a9a9-66fd73d522f7`
- **Auth flow:** SWA handles login/logout at `/.auth/login/ciam` and `/.auth/logout`
- **Roles:** Assigned by `/api/roles` endpoint based on Table Storage data
- **Route protection:** Defined in `staticwebapp.config.json` routes array (order matters — specific routes before catch-all)
- **API auth:** Functions call `getAuthUser(request)` — returns `{ userId, userDetails }` or `null`

---

## Security

- **CSP** defined in `staticwebapp.config.json` → `globalHeaders` → `Content-Security-Policy`
- When adding external scripts/images/connections, update the relevant CSP directive
- External services may redirect to CDN subdomains (e.g. `sessionize.com` → `cache.sessionize.com`) — check with `curl -sI <url>` and add all domains to CSP
- Always sanitise user input with helpers from `api/src/helpers/sanitise.js`
- Rate limiting available via `api/src/helpers/rateLimiter.js`
- SWA's `responseOverrides` rewrites 401 → CIAM login redirect, 404 → `index.html`

---

## Testing

- **API tests:** Jest — run with `cd api && npm test`
- **Test files:** Co-located or in `api/__tests__/`
- No frontend test suite currently

---

## Infrastructure

- **IaC:** Bicep templates in `infra/` (`main.bicep`, `main.bicepparam`)
- **Resource group:** `gsc-corewebsite-rg`
- **Key resources:** Storage `gsccoresa`, SWA `gsc-corewebsite-swa`, ACS `gsc-core-acs`, Key Vault `gsc-core-kv`, App Insights `gsc-core-ai`

---

## Common Pitfalls

1. **New functions not discovered** — forgot to register in `api/src/app.js` (the most common mistake)
2. **API returning HTML instead of JSON** — SWA's 404 override rewrites to `index.html`; never return 404 from API functions
3. **Stale content after deploy** — service worker or browser cache; hard refresh (Cmd+Shift+R) if needed
4. **Table Storage booleans** — `false` can come back as `"false"` (truthy in JS); always compare strictly
5. **Workflow push failures** — generation workflows need `git pull --rebase` before push
6. **Deploy race condition** — generation workflows must `sleep 5` between pushing to `main` and `live-version-swa`, otherwise GitHub may skip the SWA deploy trigger
6. **CSP blocking resources** — update CSP in `staticwebapp.config.json` when adding external URLs
