# GSC Platform — Architecture Overview

**Global Security Community** · `globalsecurity.community`

A serverless community platform connecting cybersecurity professionals through local chapters and events. Built on Microsoft Azure with zero always-on infrastructure.

---

## High-Level Architecture

```
                        ┌─────────────────┐
                        │   Cloudflare     │
                        │  DNS · WAF · CDN │
                        └────────┬────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Azure Static Web Apps   │
                    │  (gsc-corewebsite-swa)   │
                    │                          │
                    │  ┌──────┐  ┌──────────┐  │
                    │  │11ty  │  │ Azure     │  │
                    │  │Static│  │ Functions │  │
                    │  │Site  │  │ v4 (API)  │  │
                    │  └──────┘  └─────┬────┘  │
                    └──────────────────┼───────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼────────┐    ┌─────────▼────────┐    ┌─────────▼────────┐
    │  Azure Table     │    │  Azure Comms      │    │  Microsoft Entra │
    │  Storage         │    │  Services (ACS)   │    │  CIAM            │
    │  (gsccoresa)     │    │  (gsc-core-acs)   │    │  (Authentication)│
    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Platform Components

### Frontend — Eleventy Static Site

The public website is a static site built with [Eleventy 3.x](https://www.11ty.dev/) using Nunjucks templates and vanilla JavaScript. No frontend framework or build tooling — pages are pre-rendered at deploy time.

| Area | Path | Purpose |
|------|------|---------|
| Chapter pages | `/chapters/{slug}/` | Auto-generated per chapter |
| Event pages | `/events/{slug}/` | Auto-generated per event |
| Dashboard | `/dashboard/` | Admin portal for event & chapter management |
| QR Scanner | `/scanner/` | Volunteer check-in tool at events |

### Backend — Azure Functions v4

Serverless Node.js API running inside the SWA managed environment. All functions are registered centrally in `api/src/app.js`.

**Public endpoints:** Contact form, chapter applications
**Authenticated:** Event registration, ticket management, profile
**Admin:** Create/close events, check-in, badge issuance, chapter approval

### Database — Azure Table Storage

NoSQL key-value store. Six tables cover all platform data:

| Table | Purpose |
|-------|---------|
| `ChapterApplications` | Chapter lead applications & approval status |
| `Events` | Event metadata (dates, capacity, Sessionize link) |
| `EventRegistrations` | Tickets, check-in status, QR codes |
| `EventDemographics` | Attendee survey data (separated for privacy) |
| `EventBadges` | Issued digital badges |
| `EventVolunteers` | Volunteer assignments per event |

---

## Connected Services

```
┌──────────────┐     Auth (OpenID Connect)      ┌───────────────────┐
│   Browser    │◄──────────────────────────────►│  Microsoft Entra  │
│              │                                 │  CIAM             │
│              │     Role assignment             │  (B2C tenant)     │
│              │     via /api/roles              └───────────────────┘
│              │
│              │     Agenda & speakers           ┌───────────────────┐
│              │◄───────────────────────────────►│  Sessionize       │
│              │     (client-side fetch)          │  (Event schedules)│
└──────┬───────┘                                 └───────────────────┘
       │
       │  API calls
       ▼
┌──────────────┐     Transactional emails        ┌───────────────────┐
│  Azure       │────────────────────────────────►│  Azure Comms      │
│  Functions   │     (tickets, badges,            │  Services         │
│              │      confirmations)              │  (Email)          │
│              │                                 └───────────────────┘
│              │     Chapter channel creation     ┌───────────────────┐
│              │────────────────────────────────►│  Discord API      │
│              │     (bot creates text channels)  │  (Community hub)  │
│              │                                 └───────────────────┘
│              │     Chapter/event page gen       ┌───────────────────┐
│              │────────────────────────────────►│  GitHub API       │
│              │     (repository_dispatch)        │  (via Octokit)    │
└──────────────┘                                 └───────────────────┘
```

| Service | Role | Integration |
|---------|------|-------------|
| **Microsoft Entra CIAM** | Authentication & identity | OpenID Connect via SWA; roles assigned by `/api/roles` |
| **Azure Communication Services** | Transactional email | Ticket confirmations, cancellations, badge delivery |
| **Sessionize** | Event agenda management | Client-side JS fetches schedules & speaker data |
| **Discord** | Community communication | Bot creates chapter channels on approval |
| **GitHub Actions** | CI/CD & page generation | Deploys site; generates chapter/event pages on demand |
| **Cloudflare** | DNS, WAF, DDoS protection | Proxied DNS, SSL strict, HSTS, bot protection |

---

## CI/CD & Automation

```
  Developer push              Admin action (dashboard)
       │                              │
       ▼                              ▼
  ┌──────────┐              ┌───────────────────┐
  │  GitHub   │              │  repository_dispatch
  │  push to  │              │  (chapter-approved │
  │  main     │              │   or event-created)│
  └─────┬────┘              └─────────┬─────────┘
        │                             │
        ▼                             ▼
  ┌──────────────┐          ┌──────────────────┐
  │ SWA Deploy   │          │ generate-chapter  │
  │ Workflow     │          │ / generate-event  │
  │ (build+test) │          │ workflow          │
  └─────┬────────┘          └────────┬─────────┘
        │                            │
        │                   Commits new page,
        │                   pushes to main +
        ▼                   live-version-swa
  ┌──────────┐                       │
  │  Azure   │◄──────────────────────┘
  │  SWA     │
  │  (live)  │
  └──────────┘
```

**Workflows:**
- **SWA Deploy** — Builds Eleventy site, runs API tests (Jest), deploys to Azure
- **Generate Chapter/Event** — Triggered by admin approval; creates markdown page, commits, deploys
- **CodeQL** — Static analysis security scanning
- **Dependabot** — Automated dependency updates

---

## Security Posture

- **Authentication:** Microsoft Entra CIAM (enterprise-grade, MFA-capable)
- **Authorisation:** Role-based routes in SWA config (admin, volunteer, authenticated)
- **Network:** Cloudflare WAF + DDoS protection, HSTS with preload, TLS 1.2 minimum
- **Application:** Content Security Policy (no inline scripts), input sanitisation on all user data, HMAC-signed approval tokens with 7-day expiry
- **Infrastructure:** Azure Key Vault for secrets, Application Insights for monitoring
- **Code:** CodeQL SAST scanning, Dependabot for dependency vulnerabilities

---

## Cost Model

The platform runs on Azure's free and low-cost tiers:

| Resource | Tier | Notes |
|----------|------|-------|
| Static Web Apps | Standard | Custom domain, SSL, SWA-managed Functions, SLA |
| Table Storage | Pay-per-use | Fractions of a cent at current scale |
| Communication Services | Pay-per-email | ~$0.00025/email |
| Key Vault | Standard | Minimal cost for secret storage |
| Application Insights | Free tier | 5 GB/month, 30-day retention |
| Cloudflare | Free | DNS, WAF, CDN |
| GitHub | Free (private) | Actions minutes included |
| Sessionize | External | Managed by event organisers |
| Discord | Free | Bot uses free tier API |

**Total estimated monthly cost at current scale: < $5 USD**
