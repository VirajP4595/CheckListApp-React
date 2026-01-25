# PAP Checklist - Environment Setup Guide

This guide provides step-by-step instructions to set up all prerequisites for the PAP Checklist application using the provided **automation scripts**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure AD App Registration](#azure-ad-app-registration)
3. [Dataverse Provisioning (Automated)](#dataverse-provisioning-automated)
4. [SharePoint Provisioning (Automated)](#sharepoint-provisioning-automated)
5. [Seed Default Data](#seed-default-data)
6. [SPFx Solution Configuration](#spfx-solution-configuration)
7. [App Verification](#app-verification)

---

## Prerequisites

Before starting, ensure you have:

- [ ] Microsoft 365 tenant with admin access
- [ ] Power Platform environment URL (e.g., `https://[org].crm.dynamics.com`)
- [ ] SharePoint site URL (e.g., `https://[tenant].sharepoint.com/sites/[site]`)
- [ ] Node.js 18+ and npm installed
- [ ] PowerShell 7+ with modules installed:
  - `PnP.PowerShell` (for SharePoint)
  - `Microsoft.PowerApps.CLI` (PAC CLI for Dataverse auth)

### Install Required Tools

```powershell
# Install PnP PowerShell module
Install-Module -Name PnP.PowerShell -Scope CurrentUser -Force

# Install Power Platform CLI (PAC)
winget install Microsoft.PowerPlatformCLI

# Verify installations
Get-Module PnP.PowerShell -ListAvailable
pac --version
```

---

## Azure AD App Registration

The SPFx solution requires an Azure AD App Registration to access Dataverse and SharePoint APIs.

### Step 1: Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com) → **Azure Active Directory** → **App registrations**
2. Click **New registration**
3. Configure:
   - **Name:** `PAP Checklist App`
   - **Supported account types:** Accounts in this organizational directory only (Single Tenant)
   - **Platform:** Single-page application (SPA)
   - **Redirect URI:** `http://localhost:5173`
4. Click **Register**
5. Note down the **Application (client) ID** and **Directory (tenant) ID**

### Step 2: Configure API Permissions

Navigate to **API permissions** → **Add a permission**

| API | Permission | Type | Purpose |
|-----|------------|------|---------|
| **Microsoft Graph** | `User.Read` | Delegated | Get current user info |
| **Microsoft Graph** | `Sites.ReadWrite.All` | Delegated | SharePoint file operations |
| **Dynamics CRM** | `user_impersonation` | Delegated | Access Dataverse tables |

> **Important:** Click **Grant admin consent for [Tenant]** after adding all permissions.

---

## Dataverse Provisioning (Automated)

We use the Dataverse Web API via PowerShell to create all 7 tables, columns, and relationships automatically.

### Step 1: Authenticate

```powershell
# Authenticate to your Power Platform environment
pac auth create --environment "https://[your-org].crm.dynamics.com"
```

### Step 2: Run Provisioning Script

This script creates `pap_checklist`, `pap_workgroup`, `pap_checklistrow`, and all other required tables with the correct schema (1MB text limits, etc.).

```powershell
cd scripts
.\provision-dataverse-api.ps1 -EnvironmentUrl "https://[your-org].crm.dynamics.com"
```

*Expected Output:*
- Creates 7 tables
- Creates all columns
- Creates 6 lookup relationships
- Returns "Provisioning Logic Complete!"

---

## SharePoint Provisioning (Automated)

This script creates the doc library and metadata columns for file attachments.

### Step 1: Run Provisioning Script

```powershell
.\provision-sharepoint.ps1 -SiteUrl "https://[tenant].sharepoint.com/sites/pap-checklist"
```

*Expected Output:*
- Creates "PAP Attachments" library
- Creates columns: `ChecklistId`, `RowId`, `PAPFileType`, `Caption`, `DisplayOrder`, `UploadedBy`
- Creates folder structure: `_template/files`, `_template/images`

---

## Seed Default Data

Populate the `pap_defaultworkgroup` and `pap_defaultrow` tables with the stakeholder-approved templates (144 workgroups).

### Step 1: Run Automated Seeding Script

The script now automatically authenticates and seeds all 144 default workgroups and their associated rows directly into Dataverse using the Web API. No manual import is required.

```powershell
.\seed-default-data.ps1 -EnvironmentUrl "https://[your-org].crm.dynamics.com"
```

*Expected Output:*
- Authenticates with Azure CLI
- Checks/Creates 144 Workgroups (skips existing)
- Creates associated Default Rows
- Returns "Seeding Complete!"

---

## SPFx Solution Configuration

### Step 1: Update package-solution.json

The `config/package-solution.json` must request permissions matching your Azure AD app:

```json
"webApiPermissionRequests": [
  { "resource": "Microsoft Graph", "scope": "User.Read" },
  { "resource": "Microsoft Graph", "scope": "Sites.ReadWrite.All" },
  { "resource": "https://[your-org].crm.dynamics.com", "scope": "user_impersonation" }
]
```

### Step 2: Environment Config

Update `src/config/environment.ts` with your specific URLs:

```typescript
export const devConfig: IEnvironmentConfig = {
    dataverseUrl: "https://[your-org].crm.dynamics.com",
    sharePointSiteUrl: "https://[tenant].sharepoint.com/sites/pap-checklist",
    attachmentsLibrary: "PAPAttachments", // Internal name
    clientId: "[your-azure-ad-client-id]"
};
```

---

## App Verification

After deployment, verify:
1. **App Loads:** SPFx web part loads on SharePoint page
2. **Dataverse Connection:** Can fetch the list of jobs (or empty list) without 403 Forbidden
3. **SharePoint Connection:** logic-app/flow creates folders in "PAP Attachments"
4. **Templates:** Creating a new Checklist auto-populates Workgroups from the seeded data

---

## Troubleshooting

- **401/403 Error:** Check `pac auth` for scripts, or Azure AD "Grant Admin Consent" for the app.
- **Missing Columns:** Re-run the provisioning scripts (they are idempotent/skip existing).
- **Import Failures:** Check the import logs in Power Apps portal. Typically caused by lookup resolution failures (ensure names match exactly).
