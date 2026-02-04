# Global Security Community - Contact Form API

This is an Azure Function that handles contact form submissions and forwards them to Discord via webhook.

## Setup Instructions

### 1. Create a Discord Webhook

1. Go to your Discord server
2. Right-click the channel where you want form notifications → **Edit Channel**
3. Go to **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name (e.g., "GSC Contact Forms")
6. Copy the **Webhook URL**

### 2. Configure Local Settings

1. Update `local.settings.json` with your Discord webhook URL:

```json
{
  "Values": {
    "DISCORD_WEBHOOK_URL": "https://discordapp.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN"
  }
}
```

### 3. Install Dependencies

```bash
cd api
npm install
```

### 4. Run Locally (Optional)

```bash
npm start
```

The function will be available at `http://localhost:7071/api/contactForm`

### 5. Deploy to Azure

When deploying to Azure Static Web Apps, the function will be automatically available at `/api/contactForm`.

Set the environment variable in your Static Web App:
- **Name:** `DISCORD_WEBHOOK_URL`
- **Value:** Your Discord webhook URL

## Form Submission Flow

1. User submits the contact form
2. JavaScript sends POST request to `/api/contactForm`
3. Azure Function validates the data
4. Function sends formatted message to Discord
5. User sees success/error message

## Discord Message Format

Messages appear in Discord as embeds with:
- Sender's name
- Sender's email
- Subject
- Message content
- Submission timestamp

## Error Handling

The function validates:
- Required fields (name, email, subject, message)
- Email format
- Discord webhook configuration

Validation errors return appropriate HTTP status codes and error messages.
