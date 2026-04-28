# Global Security Community — Core Website

A nonprofit platform connecting cybersecurity professionals through local chapters and events.

**Live:** [globalsecurity.community](https://globalsecurity.community)
**Wiki:** [wiki.globalsecurity.community](https://wiki.globalsecurity.community)

## Quick Start

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Switch to Node 22 (required for Azure Functions)
nvm use 22

# Build the static site
npx @11ty/eleventy

# Start the full local environment (frontend + API + mock auth)
npx swa start _site --api-location api
```

Open **http://localhost:4280** — login via `/.auth/login/ciam` with mock credentials.

### Local Settings

Copy API secrets into `api/local.settings.json` (gitignored). See `.github/copilot-instructions.md` → **Local Development** for full details.

## Tech Stack

- **Frontend:** Eleventy 3.1.2 (Nunjucks + Markdown), vanilla JavaScript
- **Rich Text:** Quill.js 2.0 (CDN, dashboard only)
- **Backend:** Azure Functions v4 (Node.js)
- **Data:** Azure Table Storage
- **Email:** Azure Communication Services
- **Auth:** Azure AD B2C (CIAM) via SWA custom OpenID Connect
- **Hosting:** Azure Static Web Apps
- **CI/CD:** GitHub Actions

## Testing

```bash
cd api && npm test
```

## Branching

- `main` — development branch
- `live-version-swa` — production (merge from main to release)
