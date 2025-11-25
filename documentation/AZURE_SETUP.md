# Azure Services Setup Guide

This guide will help you set up Azure cloud services for SecureChannelX. **All services are optional** and the application will work perfectly fine without them using local fallbacks.

## 🎯 Cost Summary

| Service | Free Tier | Paid Tier | When You Pay |
|---------|-----------|-----------|--------------|
| **Key Vault** | ✅ Yes | ~$0.03 per 10,000 operations | After free tier exhausted |
| **Application Insights** | ✅ 5GB/month | ~$2.30 per GB | After 5GB/month |
| **Blob Storage** | ❌ No | ~$0.02 per GB/month | Immediately (minimal cost) |
| **App Service** | ✅ Yes (F1 tier) | From $13/month | For production hosting |

**Estimated Monthly Cost for Small App:** $0-5/month (mostly free tier usage)

---

## 📋 Prerequisites

1. **Azure Account**: Create a free account at [azure.microsoft.com](https://azure.microsoft.com/free/)
   - $200 free credit for 30 days
   - 12 months of popular free services
   - 25+ always-free services

2. **Azure CLI** (Optional but recommended):
   ```bash
   # Windows (PowerShell)
   winget install Microsoft.AzureCLI
   
   # Login to Azure
   az login
   ```

---

## 🔐 Step 1: Azure Key Vault Setup (Optional)

**Purpose**: Securely store secrets (JWT keys, API keys) instead of `.env` files

**Cost**: FREE tier available, ~$0.03 per 10,000 operations after

### Create Key Vault

1. **Via Azure Portal**:
   - Go to [portal.azure.com](https://portal.azure.com)
   - Search for "Key Vaults" → Click "Create"
   - Fill in:
     - **Resource Group**: Create new → `securechannelx-rg`
     - **Key Vault Name**: `securechannelx-kv` (must be globally unique)
     - **Region**: Choose closest to you
     - **Pricing Tier**: Standard
   - Click "Review + Create" → "Create"

2. **Via Azure CLI**:
   ```bash
   # Create resource group
   az group create --name securechannelx-rg --location eastus
   
   # Create Key Vault
   az keyvault create \
     --name securechannelx-kv \
     --resource-group securechannelx-rg \
     --location eastus
   ```

### Get Connection Details

1. Go to your Key Vault → **Overview**
2. Copy the **Vault Name** (e.g., `securechannelx-kv`)
3. Update `.env`:
   ```env
   AZURE_KEY_VAULT_NAME=securechannelx-kv
   ```

### Store Secrets (Optional)

```bash
# Store JWT secret in Key Vault
az keyvault secret set \
  --vault-name securechannelx-kv \
  --name JWT-SECRET-KEY \
  --value "your-jwt-secret-here"
```

---

## 📊 Step 2: Application Insights Setup (Recommended)

**Purpose**: Monitor application performance, track errors, and user analytics

**Cost**: FREE tier (5GB/month) - sufficient for most applications

### Create Application Insights

1. **Via Azure Portal**:
   - Search for "Application Insights" → Click "Create"
   - Fill in:
     - **Resource Group**: `securechannelx-rg` (same as above)
     - **Name**: `securechannelx-insights`
     - **Region**: Same as Key Vault
     - **Resource Mode**: Workspace-based
   - Click "Review + Create" → "Create"

2. **Via Azure CLI**:
   ```bash
   az monitor app-insights component create \
     --app securechannelx-insights \
     --location eastus \
     --resource-group securechannelx-rg
   ```

### Get Connection String

1. Go to Application Insights → **Overview**
2. Copy the **Connection String** (starts with `InstrumentationKey=...`)
3. Update `.env`:
   ```env
   APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=abc123...;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/
   ```

4. **Frontend**: Create `frontend/.env`:
   ```env
   VITE_APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=abc123...
   ```

---

## 📁 Step 3: Azure Blob Storage Setup (Optional)

**Purpose**: Store chat attachments, profile pictures, and files

**Cost**: ~$0.02 per GB/month (Hot tier) - pay only for what you use

### Create Storage Account

1. **Via Azure Portal**:
   - Search for "Storage accounts" → Click "Create"
   - Fill in:
     - **Resource Group**: `securechannelx-rg`
     - **Storage Account Name**: `securechannelxstorage` (lowercase, no hyphens)
     - **Region**: Same as above
     - **Performance**: Standard
     - **Redundancy**: LRS (cheapest)
   - Click "Review + Create" → "Create"

2. **Via Azure CLI**:
   ```bash
   az storage account create \
     --name securechannelxstorage \
     --resource-group securechannelx-rg \
     --location eastus \
     --sku Standard_LRS
   ```

### Get Connection String

1. Go to Storage Account → **Access keys**
2. Click "Show keys"
3. Copy **Connection string** from key1
4. Update `.env`:
   ```env
   AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=securechannelxstorage;AccountKey=...;EndpointSuffix=core.windows.net
   AZURE_STORAGE_CONTAINER_NAME=chat-files
   ```

---

## 🚀 Step 4: Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

---

## ✅ Step 5: Verify Setup

### Test Backend

```bash
cd backend
python run.py
```

**Expected Output**:
```
✅ Azure Key Vault connected: securechannelx-kv
✅ Azure Application Insights initialized
✅ Azure Blob Storage connected: chat-files
✅ Azure telemetry middleware enabled
```

**OR (if Azure not configured)**:
```
📝 Azure Key Vault disabled - using environment variables
📝 Application Insights disabled - using console logging
📝 Azure Blob Storage disabled - using local filesystem
```

### Test Frontend

```bash
cd frontend
npm run dev
```

Open browser console and look for:
```
✅ Azure Application Insights initialized
```

---

## 🔧 Local Development (No Azure Required)

If you don't configure Azure services, the application automatically uses:

- **Key Vault** → Environment variables from `.env`
- **Application Insights** → Console logging
- **Blob Storage** → Local `backend/uploads/` directory

**This is perfect for development and testing!**

---

## 💰 Cost Optimization Tips

1. **Use Free Tiers**: Application Insights and Key Vault have generous free tiers
2. **Delete Unused Resources**: Remove resources you're not using
3. **Use LRS Storage**: Locally Redundant Storage is cheapest
4. **Monitor Costs**: Set up budget alerts in Azure Portal
5. **Development**: Use local fallbacks during development (zero cost)

### Set Up Budget Alert

```bash
# Create budget alert for $10/month
az consumption budget create \
  --budget-name securechannelx-budget \
  --amount 10 \
  --time-grain Monthly \
  --resource-group securechannelx-rg
```

---

## 🔍 Monitoring Your Application

### View Telemetry

1. Go to Azure Portal → Application Insights
2. Click on your instance → **Live Metrics**
3. Use your application and see real-time data!

### View Logs

1. Application Insights → **Logs**
2. Query examples:
   ```kusto
   // View all events
   customEvents
   | where timestamp > ago(1h)
   | order by timestamp desc
   
   // View exceptions
   exceptions
   | where timestamp > ago(24h)
   | order by timestamp desc
   ```

---

## 🛠️ Troubleshooting

### "Azure services initialization skipped"

**Solution**: This is normal if you haven't configured Azure. The app uses local fallbacks.

### "Failed to connect to Key Vault"

**Solutions**:
1. Verify vault name in `.env` is correct
2. Ensure you're logged in: `az login`
3. Grant yourself access:
   ```bash
   az keyvault set-policy \
     --name securechannelx-kv \
     --upn your-email@example.com \
     --secret-permissions get list set delete
   ```

### "Application Insights not receiving data"

**Solutions**:
1. Verify connection string is correct
2. Check firewall settings
3. Wait 2-3 minutes for data to appear

---

## 🎓 Next Steps

1. **Deploy to Azure App Service**: Host your application in the cloud
2. **Set Up CI/CD**: Automate deployments with Azure Pipelines
3. **Add Azure AD**: Enterprise authentication
4. **Scale Up**: Increase resources as your app grows

---

## 📚 Additional Resources

- [Azure Free Account](https://azure.microsoft.com/free/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [Application Insights Documentation](https://docs.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Key Vault Documentation](https://docs.microsoft.com/azure/key-vault/)
- [Blob Storage Documentation](https://docs.microsoft.com/azure/storage/blobs/)

---

## ❓ FAQ

**Q: Do I need Azure to run SecureChannelX?**  
A: No! The application works perfectly without Azure using local fallbacks.

**Q: What's the minimum cost to use Azure?**  
A: $0-5/month if you stay within free tiers. Blob Storage is the only service without a free tier (~$0.02/GB).

**Q: Can I use only some Azure services?**  
A: Yes! Configure only what you need. Each service is independent.

**Q: How do I delete everything?**  
A: Delete the resource group: `az group delete --name securechannelx-rg`
