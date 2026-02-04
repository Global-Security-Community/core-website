# Global Security Community - Contact Form API

This is an Azure Function that handles contact form submissions and forwards them to Discord via webhook.

## Security Features

- ✅ **Rate Limiting**: IP-based rate limiting (5 requests per hour by default)
- ✅ **Input Validation**: All fields validated for length and format
- ✅ **Email Validation**: Regex-based email format checking
- ✅ **Secrets Management**: Discord webhook stored as environment variable (never in code)
- ✅ **Error Handling**: Generic error messages to users (no sensitive info leaked)

## Setup Instructions

### 1. Create a Discord Webhook

1. Go to your Discord server
2. Right-click the channel where you want form notifications → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name (e.g., "GSC Contact Forms")
6. Copy the **Webhook URL**

> ⚠️ **SECURITY**: Never commit your webhook URL to git! Anyone with the URL can post to your Discord channel.

### 2. Configure Local Development

1. Copy the example settings file:
```bash
cp local.settings.json.example local.settings.json
```

2. Edit `local.settings.json` with your Discord webhook URL:
```json
{
  "Values": {
    "DISCORD_WEBHOOK_URL": "https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
  }
}
```

> **Note**: `local.settings.json` is in `.gitignore` and will never be committed.

### 3. Install Dependencies

```bash
cd api
npm install
```

### 4. Run Locally

Use the SWA CLI for full local development (recommended):
```bash
# From the root directory
swa start http://localhost:8080 --run "npm start" --api-location ./api
```

Or run the API standalone:
```bash
cd api
npm start
```

## Deploying to Azure

### Option A: Azure Portal (Recommended for Security)

1. Create an Azure Static Web App in the Azure Portal
2. Connect it to your GitHub repository
3. After deployment, go to **Configuration** → **Application settings**
4. Add the following environment variables:

| Name | Value |
|------|-------|
| `DISCORD_WEBHOOK_URL` | `https://discord.com/api/webhooks/...` |
| `RATE_LIMIT_WINDOW_MS` | `3600000` (optional, defaults to 1 hour) |
| `MAX_REQUESTS_PER_WINDOW` | `5` (optional) |

### Option B: GitHub Actions (Advanced)

For CI/CD, store your Discord webhook URL as a GitHub Secret:

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Create a new secret: `DISCORD_WEBHOOK_URL`
3. In your GitHub Actions workflow, pass it to the deployment

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DISCORD_WEBHOOK_URL` | ✅ Yes | - | Discord webhook URL for form notifications |
| `RATE_LIMIT_WINDOW_MS` | No | `3600000` | Rate limit window in milliseconds (1 hour) |
| `MAX_REQUESTS_PER_WINDOW` | No | `5` | Max requests per IP per window |

## Security Best Practices

### Discord Webhook Security

1. **Regenerate if Compromised**: If your webhook URL is ever exposed, immediately regenerate it in Discord
2. **Channel Permissions**: Use a private channel for form submissions
3. **Webhook Name**: Use a descriptive name so you can identify it later

### If Your Webhook Is Leaked

1. Go to Discord → Server Settings → Integrations → Webhooks
2. Find your webhook and click **Delete**
3. Create a new webhook
4. Update the `DISCORD_WEBHOOK_URL` in Azure Portal

## Form Submission Flow

1. User submits the contact form
2. JavaScript sends POST request to `/api/contactForm`
3. Azure Function validates the data
4. Rate limit check (IP-based)
5. Function sends formatted message to Discord
6. User sees success/error message

## Discord Message Format

Messages appear in Discord as embeds with:
- 📧 Sender's name
- 📧 Sender's email
- 📧 Subject
- 📧 Message content
- 📧 Submission timestamp

## Error Responses

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing required fields | One or more fields empty |
| 400 | Field length exceeds maximum | Name >100, Subject >200, or Message >5000 chars |
| 400 | Invalid email format | Email doesn't match expected pattern |
| 405 | Method not allowed | Non-POST request |
| 429 | Too many requests | Rate limit exceeded |
| 500 | Configuration error | `DISCORD_WEBHOOK_URL` not set |
| 500 | Failed to send message | Discord API error |
