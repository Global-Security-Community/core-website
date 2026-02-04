# Testing in GitHub Codespaces

This project includes a devcontainer configuration for easy testing in GitHub Codespaces with the correct Node.js version.

## Quick Start in Codespaces

1. **Open in Codespaces:**
   - Go to your GitHub repo
   - Click the green "Code" button
   - Select "Codespaces" tab
   - Click "Create codespace on main"

2. **Configure Discord Webhook:**
   - Create `api/local.settings.json` with your Discord webhook:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "AzureWebJobsStorage": "",
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "DISCORD_WEBHOOK_URL": "YOUR_DISCORD_WEBHOOK_URL",
       "RATE_LIMIT_WINDOW_MS": "3600000",
       "MAX_REQUESTS_PER_WINDOW": "5"
     }
   }
   ```

3. **Start the servers:**
   
   Terminal 1 - Start Azure Functions:
   ```bash
   cd api
   func start
   ```
   
   Terminal 2 - Start Eleventy:
   ```bash
   npm start
   ```

4. **Test the form:**
   - Open http://localhost:8080/contact/
   - Fill out and submit the form
   - Check your Discord channel for the message

## What's Configured

- **Node.js 20:** Compatible with Azure Functions v4
- **Azure Functions Core Tools:** Pre-installed
- **Ports:** 8080 (website) and 7071 (API) forwarded automatically
- **Extensions:** Azure Functions and Azure CLI tools

## Notes

- `local.settings.json` is gitignored and won't be committed
- Rate limiting is set to 5 requests per hour per IP by default
- Adjust limits in `local.settings.json` if needed for testing
