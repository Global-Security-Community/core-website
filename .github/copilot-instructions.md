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
**Deployment branch:** `live-version-swa` (merge from `main` to release)

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
├── e2e/                          # Playwright E2E tests
│   ├── helpers.js                # mockLogin (cookie-based) and docScreenshot utilities
│   ├── public-pages.spec.js      # Public page tests (14 tests)
│   ├── authenticated-flows.spec.js # Auth flow tests (7 tests)
│   └── admin-dashboard.spec.js   # Admin dashboard tests (4 tests)
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
- Tables: `Chapters`, `Events`, `EventRegistrations`, `EventDemographics`, `EventBadges`, `ContactSubmissions`, `ChapterApplications`
- PartitionKey/RowKey patterns vary per table — check existing helpers
- Boolean values from Table Storage can arrive as strings (`"true"`/`"false"`) — always use strict comparison: `=== true || === 'true'`

### Registration Roles

Every registration in `EventRegistrations` has a `role` field. Valid roles:
- `attendee` (default) — standard event attendee
- `volunteer` — event volunteer; shown on event page, grants scanner access
- `speaker` — event speaker; bypasses registration cap
- `sponsor` — event sponsor; bypasses registration cap
- `organiser` — event organiser; bypasses registration cap, grants scanner access

Existing records without a `role` field default to `attendee` in code. The `VALID_ROLES` array is exported from `tableStorage.js`.

**Scanner access** is granted to users whose email matches any registration with role `volunteer` or `organiser` (checked via `isVolunteerOrOrganiserByRegistration()`). There is also a legacy fallback to the `EventVolunteers` table.

**Admin role management:**
- `POST /api/updateRegistrationRole` — bulk update roles for selected registrations
- `POST /api/adminRegister` — register someone with a specific role (bypasses cap for speaker/sponsor/organiser)

### Chapter Data

Chapter data is stored on the `ChapterApplications` table. After approval, the chapter slug is derived from the city name. Leads can be edited via the dashboard:
- `GET /api/getChapter?slug={slug}` — returns chapter leads (from `leadsJson` field or original application fields)
- `POST /api/updateChapter` — updates leads (up to 4) and regenerates the chapter markdown page via GitHub Contents API
- Lead social links: GitHub, LinkedIn, Twitter/X, Website
- The `leadsJson` field stores the edited leads as a JSON string; original application fields are kept as fallback

---

## Email (Azure Communication Services)

- All email functions in `api/src/helpers/emailService.js`
- Sender: `DoNotReply@globalsecurity.community`
- ACS resource: `gsc-core-acs`, Email service: `gsc-core-ces`
- Send emails as non-blocking fire-and-forget (don't fail the parent operation if email fails)
- Ticket confirmation email includes: event details, QR code, "View Event" button (links to event page), "My Tickets" button, and Discord invite section with chapter name
- All emails use `emailLayout()` wrapper for consistent GSC branding (dark header, teal accent gradient)

---

## Branching Strategy

- **`main`** — Development branch. All day-to-day work, feature branches, and generation workflows target `main`.
- **`live-version-swa`** — Production branch. Deployed to Azure SWA. Only updated by merging `main` into it when a release is ready.
- **Feature branches** — For larger features, create a branch off `main`, work on it, then PR back to `main`.
- **Releasing to production:**
  ```bash
  git checkout live-version-swa
  git merge main
  git push origin live-version-swa
  git checkout main
  ```
- **Generation workflows** (`generate-event.yml`, `generate-chapter.yml`, `delete-chapter.yml`) push to `main` only. They do NOT push to `live-version-swa`. Changes reach production on the next release merge.
- **Never push directly to `live-version-swa`** — always merge from `main`.

---

## Deployment

- **Frontend:** Eleventy builds to `_site/`, deployed by Azure SWA GitHub Action
- **API:** Azure Functions in `api/` deployed alongside SWA
- **SWA deploy triggers** on push to `live-version-swa` or PRs targeting it
- **Generation workflows** push to `main` only — changes reach production on next release merge

---

## Local Development

### Prerequisites

- **Node.js 22** (Azure Functions Core Tools v4 requires ≤22)
- **nvm** for switching Node versions: `nvm install 22`
- Dev dependencies installed: `npm install` (includes SWA CLI and Azure Functions Core Tools)

### Starting the Local Environment

```bash
# Switch to Node 22 (required — Node 25+ is incompatible with Azure Functions)
nvm use 22

# Build the static site
npx @11ty/eleventy

# Start the full SWA emulator (frontend + API + mock auth)
npx swa start _site --api-location api
```

The emulator starts at **http://localhost:4280** with:
- Static site served from `_site/`
- API functions on port 7071, proxied through 4280
- Mock authentication (no real CIAM/OTP needed)

### Mock Authentication

Navigate to `http://localhost:4280/.auth/login/ciam` to see a mock login form.
Fill in:
- **Username:** any email (e.g. `test@example.com`)
- **Roles:** comma-separated, e.g. `authenticated,admin` for full dashboard access

Available roles: `anonymous`, `authenticated`, `admin`, `volunteer`

### Local Settings

API secrets are stored in `api/local.settings.json` (gitignored). Required values:

| Setting | Description |
|---------|-------------|
| `AZURE_STORAGE_CONNECTION_STRING` | Azure Table Storage connection string |
| `CIAM_CLIENT_ID` | Azure AD B2C app client ID |
| `CIAM_CLIENT_SECRET` | Azure AD B2C app client secret |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | ACS connection (optional — emails fail gracefully) |
| `DISCORD_BOT_TOKEN` | Discord bot token (optional — notifications fail gracefully) |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | GitHub App credentials (optional — chapter edit won't push to repo) |

To get these values: Azure Portal → `gsc-corewebsite-swa` → Configuration → Application settings

### Known Issues

- **`/admin*` routes reserved locally** — Azure Functions Core Tools reserves paths starting with `/admin`. The `adminRegister` function uses route `/api/manualRegister` to avoid this. Do not create new API routes starting with `admin`.
- **Node version mismatch** — If you see "incompatible with your current Node.js", run `nvm use 22`
- **First run downloads Core Tools** — SWA CLI downloads ~200MB of Azure Functions Core Tools on first run. This is cached for subsequent runs.

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
- **E2E tests:** Playwright — run with `npm run test:e2e` (or `npm run test:e2e:headed` for visible browser)
- **E2E test files:** `e2e/` directory — `public-pages.spec.js`, `authenticated-flows.spec.js`, `admin-dashboard.spec.js`
- **E2E prerequisites:** SWA emulator must be running at `localhost:4280` before running tests (not auto-started)
- **Mock auth in E2E:** Tests use cookie-based auth bypass — `mockLogin()` in `e2e/helpers.js` sets `StaticWebAppsAuthCookie` directly (Playwright's `fill()` doesn't trigger jQuery event handlers in SWA CLI's mock auth form)

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
6. **CSP blocking resources** — update CSP in `staticwebapp.config.json` when adding external URLs
7. **`/admin*` routes fail locally** — Azure Functions reserves these paths; use alternative route names (e.g. `manualRegister` not `adminRegister`)
8. **Wrong Node version** — Local SWA CLI requires Node ≤22; run `nvm use 22` before starting
9. **SWA route wildcard ordering** — `/api/*` catch-all must be the LAST route entry; placing it before specific routes causes build failures
