# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| `main` branch (latest) | ✅ |
| `live-version-swa` (production) | ✅ |
| Older commits / tags | ❌ |

## Reporting a Vulnerability

We take the security of the Global Security Community platform seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities.
2. Email your findings to the maintainers at the address listed in our [security.txt](https://globalsecurity.community/.well-known/security.txt).
3. Alternatively, use [GitHub's private vulnerability reporting](https://github.com/Global-Security-Community/core-website/security/advisories/new) to submit a report directly.

### What to Include

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Any relevant screenshots, logs, or proof-of-concept code
- Your suggested fix (if you have one)

### What to Expect

- **Acknowledgement** within 72 hours of your report
- **Assessment** — we will evaluate severity and impact within 7 days
- **Resolution** — critical vulnerabilities will be patched within 14 days; lower-severity issues within 30 days
- **Credit** — with your permission, we will credit you in the fix commit or release notes

### Scope

The following are in scope for security reports:

- The production website at `globalsecurity.community`
- API endpoints under `/api/*`
- Authentication and authorisation flows
- Data exposure or leakage from Azure Table Storage
- Cross-site scripting (XSS), injection, or CSRF bypasses
- Secrets or credentials exposed in source code or logs

### Out of Scope

- Denial of service attacks against our infrastructure
- Social engineering of community members or maintainers
- Issues in third-party services (Azure, Cloudflare, Discord) unless caused by our misconfiguration
- Vulnerabilities in dependencies that are not exploitable in our usage context

## Security Practices

This project employs the following security measures:

- **Content Security Policy (CSP)** — strict policy in `staticwebapp.config.json`
- **CSRF protection** — custom header verification on all state-changing endpoints
- **Input sanitisation** — all user input sanitised via `sanitize-html` and custom helpers
- **Authentication** — Azure AD B2C (CIAM) with role-based access control
- **Automated scanning** — GitHub CodeQL analysis runs weekly and on all PRs
- **Dependency monitoring** — Dependabot configured for all package ecosystems
- **Security headers** — HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff
