#!/bin/bash
# check-secrets.sh
#
# Checks which secrets are set in SWA app settings and GitHub Secrets.
# Does NOT print secret values — only shows present/missing status.
#
# Usage:
#   cd infra
#   az login
#   ./check-secrets.sh

set -euo pipefail

RG="gsc-corewebsite-rg"
SWA_NAME="gsc-corewebsite-swa"
REPO="Global-Security-Community/core-website"

echo "🔍 GSC Secrets Audit"
echo "===================="
echo ""

# ── SWA App Settings ────────────────────────────────────────────────────
echo "📦 Azure SWA App Settings (runtime API)"
echo "────────────────────────────────────────"

SETTINGS=$(az staticwebapp appsettings list \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --query "properties" -o json 2>/dev/null || echo "{}")

# All expected env vars (secrets + non-secrets)
EXPECTED_VARS=(
  "AZURE_STORAGE_CONNECTION_STRING"
  "CIAM_CLIENT_ID"
  "CIAM_CLIENT_SECRET"
  "AZURE_COMMUNICATION_CONNECTION_STRING"
  "ACS_SENDER_ADDRESS"
  "APPROVAL_TOKEN_SECRET"
  "AZURE_AI_KEY"
  "SITE_BASE_URL"
  "DISCORD_BOT_TOKEN"
  "DISCORD_GUILD_ID"
  "DISCORD_CONTACT_CHANNEL_ID"
  "DISCORD_NOTIFICATIONS_CHANNEL_ID"
  "DISCORD_CHAPTERS_CATEGORY_ID"
  "GITHUB_APP_ID"
  "GITHUB_APP_INSTALLATION_ID"
  "GITHUB_APP_PRIVATE_KEY"
  "GITHUB_REPO_OWNER"
  "GITHUB_REPO_NAME"
)

for VAR in "${EXPECTED_VARS[@]}"; do
  VALUE=$(echo "$SETTINGS" | python3 -c "import sys,json; v=json.load(sys.stdin).get('${VAR}',''); print('SET' if v else 'MISSING')" 2>/dev/null || echo "ERROR")
  if [ "$VALUE" = "SET" ]; then
    echo "  ✅ ${VAR}"
  else
    echo "  ❌ ${VAR} — NOT SET"
  fi
done

# ── GitHub Secrets ──────────────────────────────────────────────────────
echo ""
echo "🔑 GitHub Secrets (for workflows)"
echo "────────────────────────────────────────"
echo "  (GitHub API doesn't expose values, showing which exist)"

GH_SECRETS=$(gh secret list --repo "$REPO" 2>/dev/null || echo "FAILED")

if [ "$GH_SECRETS" = "FAILED" ]; then
  echo "  ⚠️  Could not list GitHub secrets (need 'gh auth login')"
else
  EXPECTED_GH_SECRETS=(
    "AZURE_STATIC_WEB_APPS_API_TOKEN_LIVELY_DESERT_0F1F18C10"
    "AZURE_CLIENT_ID"
    "AZURE_TENANT_ID"
    "AZURE_SUBSCRIPTION_ID"
    "AZURE_RESOURCE_GROUP"
    "DISCORD_BOT_TOKEN"
    "DISCORD_GUILD_ID"
  )
  for SECRET in "${EXPECTED_GH_SECRETS[@]}"; do
    if echo "$GH_SECRETS" | grep -q "^${SECRET}"; then
      echo "  ✅ ${SECRET}"
    else
      echo "  ❌ ${SECRET} — NOT SET"
    fi
  done
fi

# ── SWA Managed Identity ───────────────────────────────────────────────
echo ""
echo "🪪 SWA Managed Identity"
echo "────────────────────────────────────────"
IDENTITY=$(az staticwebapp show \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --query "identity.principalId" -o tsv 2>/dev/null || echo "")

if [ -n "$IDENTITY" ] && [ "$IDENTITY" != "None" ]; then
  echo "  ✅ System-assigned identity enabled (${IDENTITY})"
else
  echo "  ❌ No managed identity — run: az staticwebapp identity assign --name ${SWA_NAME} -g ${RG}"
fi

echo ""
echo "════════════════════════════════════════"
echo ""
echo "For any ❌ MISSING items, here's where to find the values:"
echo ""
echo "  DISCORD_BOT_TOKEN"
echo "    → Discord Developer Portal → Applications → your bot → Bot → Reset Token"
echo "    → https://discord.com/developers/applications"
echo ""
echo "  DISCORD_GUILD_ID"
echo "    → Discord → right-click your server name → Copy Server ID"
echo "    → (Enable Developer Mode first: User Settings → Advanced → Developer Mode)"
echo ""
echo "  DISCORD_CONTACT_CHANNEL_ID / DISCORD_NOTIFICATIONS_CHANNEL_ID"
echo "    → Discord → right-click the target channel → Copy Channel ID"
echo ""
echo "  DISCORD_CHAPTERS_CATEGORY_ID"
echo "    → Discord → right-click the category header → Copy Channel ID"
echo ""
echo "  AZURE_STORAGE_CONNECTION_STRING"
echo "    → Azure Portal → gsccoresa → Access keys → Connection string"
echo ""
echo "  CIAM_CLIENT_ID / CIAM_CLIENT_SECRET"
echo "    → Entra admin center → App registrations → your app → Overview / Certificates & secrets"
echo ""
echo "  AZURE_COMMUNICATION_CONNECTION_STRING"
echo "    → Azure Portal → gsc-core-acs → Keys → Connection string"
echo ""
echo "  APPROVAL_TOKEN_SECRET"
echo "    → Any random string (generate with: openssl rand -hex 32)"
echo ""
echo "  AZURE_AI_KEY"
echo "    → Azure Portal → your Azure AI resource → Keys and Endpoint"
echo ""
echo "  GITHUB_APP_ID / GITHUB_APP_INSTALLATION_ID / GITHUB_APP_PRIVATE_KEY"
echo "    → GitHub → Settings → Developer settings → GitHub Apps → your app"
