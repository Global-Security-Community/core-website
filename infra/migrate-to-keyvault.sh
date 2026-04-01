#!/bin/bash
# migrate-to-keyvault.sh
#
# One-shot migration: moves SWA app settings from plain text to Key Vault references.
# Run once from this directory. Safe to re-run — Key Vault secrets are overwritten,
# SWA settings are updated to reference them.
#
# Prerequisites:
#   - Azure CLI installed and logged in (az login)
#   - Sufficient permissions: Key Vault Administrator + SWA Contributor
#
# Usage:
#   cd infra
#   chmod +x migrate-to-keyvault.sh
#   ./migrate-to-keyvault.sh

set -euo pipefail

RG="gsc-corewebsite-rg"
SWA_NAME="gsc-corewebsite-swa"
VAULT_NAME="gsc-core-kv"

echo "🔐 GSC Key Vault Migration"
echo "=========================="
echo ""

# ── Step 1: Enable system-assigned managed identity on SWA ──────────────
echo "1️⃣  Enabling managed identity on ${SWA_NAME}..."
az staticwebapp identity assign \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --output none

PRINCIPAL_ID=$(az staticwebapp show \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --query "identity.principalId" -o tsv)

echo "   Principal ID: ${PRINCIPAL_ID}"

# ── Step 2: Deploy Bicep with the SWA principal ID ──────────────────────
echo ""
echo "2️⃣  Deploying Bicep (role assignment for Key Vault access)..."
az deployment group create \
  --resource-group "$RG" \
  --template-file ./main.bicep \
  --parameters swaPrincipalId="$PRINCIPAL_ID" \
  --output none

echo "   ✅ Key Vault Secrets User role assigned"

# ── Step 3: Migrate secrets ─────────────────────────────────────────────
echo ""
echo "3️⃣  Migrating secrets to Key Vault..."

# Secrets to migrate: "KEY_VAULT_NAME:SWA_APP_SETTING_NAME"
# Key Vault secret names use hyphens (no underscores allowed)
SECRETS=(
  "AZURE-STORAGE-CONNECTION-STRING:AZURE_STORAGE_CONNECTION_STRING"
  "CIAM-CLIENT-SECRET:CIAM_CLIENT_SECRET"
  "AZURE-COMMUNICATION-CONNECTION-STRING:AZURE_COMMUNICATION_CONNECTION_STRING"
  "APPROVAL-TOKEN-SECRET:APPROVAL_TOKEN_SECRET"
  "AZURE-AI-KEY:AZURE_AI_KEY"
  "DISCORD-BOT-TOKEN:DISCORD_BOT_TOKEN"
  "GITHUB-APP-PRIVATE-KEY:GITHUB_APP_PRIVATE_KEY"
)

# Non-secret settings that should NOT go in Key Vault (IDs, URLs, addresses)
# These stay as plain SWA app settings:
#   CIAM_CLIENT_ID, ACS_SENDER_ADDRESS, SITE_BASE_URL
#   GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_REPO_OWNER, GITHUB_REPO_NAME
#   DISCORD_GUILD_ID, DISCORD_CONTACT_CHANNEL_ID, DISCORD_NOTIFICATIONS_CHANNEL_ID
#   DISCORD_CHAPTERS_CATEGORY_ID

# Get all current SWA app settings as JSON
CURRENT_SETTINGS=$(az staticwebapp appsettings list \
  --name "$SWA_NAME" \
  --resource-group "$RG" \
  --query "properties" -o json)

MIGRATED=0
SKIPPED=0

for SECRET_PAIR in "${SECRETS[@]}"; do
  KV_NAME="${SECRET_PAIR%%:*}"
  ENV_NAME="${SECRET_PAIR##*:}"

  # Extract value from current settings
  VALUE=$(echo "$CURRENT_SETTINGS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('${ENV_NAME}',''))" 2>/dev/null || echo "")

  # Skip if empty, null, or already a Key Vault reference
  if [ -z "$VALUE" ] || [ "$VALUE" = "null" ]; then
    echo "   ⚠️  ${ENV_NAME} — not set, skipping"
    ((SKIPPED++))
    continue
  fi

  if [[ "$VALUE" == @Microsoft.KeyVault* ]]; then
    echo "   ⏭️  ${ENV_NAME} — already a Key Vault reference"
    ((SKIPPED++))
    continue
  fi

  # Store in Key Vault
  az keyvault secret set \
    --vault-name "$VAULT_NAME" \
    --name "$KV_NAME" \
    --value "$VALUE" \
    --output none 2>/dev/null

  # Get the versionless secret URI
  SECRET_URI="https://${VAULT_NAME}.vault.azure.net/secrets/${KV_NAME}"

  # Update SWA to use Key Vault reference
  az staticwebapp appsettings set \
    --name "$SWA_NAME" \
    --resource-group "$RG" \
    --setting-names "${ENV_NAME}=@Microsoft.KeyVault(SecretUri=${SECRET_URI})" \
    --output none

  echo "   ✅ ${ENV_NAME} → ${KV_NAME}"
  ((MIGRATED++))
done

# ── Summary ─────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo "  Migration complete"
echo "  Migrated: ${MIGRATED} secrets"
echo "  Skipped:  ${SKIPPED} settings"
echo "════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  • Verify the site works: https://globalsecurity.community"
echo "  • Submit a contact form to test Discord notifications"
echo "  • For secrets that were skipped (not set), add them to Key Vault first:"
echo "    az keyvault secret set --vault-name ${VAULT_NAME} --name SECRET-NAME --value 'value'"
echo "    Then set the SWA reference:"
echo "    az staticwebapp appsettings set --name ${SWA_NAME} -g ${RG} \\"
echo "      --setting-names \"ENV_NAME=@Microsoft.KeyVault(SecretUri=https://${VAULT_NAME}.vault.azure.net/secrets/SECRET-NAME)\""
echo ""
echo "  • To add a new secret in the future, use the same pattern:"
echo "    1. az keyvault secret set --vault-name ${VAULT_NAME} --name MY-SECRET --value 'value'"
echo "    2. az staticwebapp appsettings set --name ${SWA_NAME} -g ${RG} \\"
echo "       --setting-names \"MY_ENV_VAR=@Microsoft.KeyVault(SecretUri=https://${VAULT_NAME}.vault.azure.net/secrets/MY-SECRET)\""
