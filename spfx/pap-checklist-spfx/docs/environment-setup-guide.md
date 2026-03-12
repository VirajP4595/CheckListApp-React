# PAP Checklist - Environment Setup Guide

> **Note:** This guide is for setting up a **Development Environment**. For Production deployment, see the [Migration Guide](migration-guide.md).

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
  - `Azure CLI` (`az`) (for Dataverse auth)

### Install Required Tools

```powershell
# Install PnP PowerShell module
Install-Module -Name PnP.PowerShell -Scope CurrentUser -Force

# Install Azure CLI (if not installed)
# Download from: https://aka.ms/installazurecli
# Or via Winget:
winget install Microsoft.AzureCLI

# Verify installations
Get-Module PnP.PowerShell -ListAvailable
az version
```

---

## Azure AD App Registration & API Permissions

Since this is an SPFx solution, authentication is handled automatically by the SharePoint host. You **do NOT** need to manually create an Azure AD App Registration for the frontend.

However, you must approve the API permissions requested by the solution.

### Step 1: Deploy & Approve Permissions

1.  **Build & Package**:
    ```powershell
    npm run build
    # This creates sharepoint/solution/pap-checklist-spfx.sppkg
    ```
2.  **Upload to App Catalog**:
    - Go to your SharePoint Admin Center -> **Apps**.
    - Upload the `.sppkg` file.
    - Check "Make this solution available to all sites in the organization".
    - Click **Deploy**.

3.  **Approve API Access**:
    - Go to SharePoint Admin Center -> **Advanced** -> **API access**.
    - You will see pending requests for **Microsoft Graph** and **Dataverse**.
    - Select them and click **Approve**.

---

## Dataverse Provisioning (Automated)

We use the Dataverse Web API via PowerShell to create all required tables, columns, and relationships automatically.

### Step 1: Authenticate

```powershell
# Authenticate to Azure CLI (used by the script)
az login --allow-no-subscriptions
```

### Step 2: Run Provisioning Script

This script creates `pap_checklist`, `pap_workgroup`, `pap_checklistrow`, and all other required tables with the correct schema (1MB text limits, etc.).

```powershell
cd scripts
.\provision-dataverse-api.ps1 -EnvironmentUrl "https://[your-org].crm.dynamics.com"
```

*Expected Output:*
- Creates tables (Checklist, Workgroup, Row, Revision, ActivityLog, Templates)
- Creates all columns
- Creates lookup relationships
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

Populate the `pap_defaultworkgroup` and `pap_defaultrow` tables with the stakeholder-approved templates.

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

## Application Configuration

### Step 1: Update Environment Config

The application uses a configuration file to connect to your specific environment.
Update `src/config/environment.ts` with your Dataverse and SharePoint details:

```typescript
export const AppConfig = {
    dataverse: {
        url: "https://[your-org].crm.dynamics.com",
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        absoluteUrl: "https://[tenant].sharepoint.com/sites/pap-checklist", // Ensure this matches your site
        documentLibrary: "PAPAttachments"
    }
    // Auth is handled automatically by SPFx
};
```

---

## App Verification (Local Workbench)

Since SPFx 1.18+, the Local Workbench is deprecated. You must use the **Hosted Workbench**.

1.  **Start Local Server**:
    ```powershell
    npm start
    ```
    This will start the local server on https://localhost:4321.

2.  **Open Hosted Workbench**:
    Navigate to your SharePoint site's workbench:
    `https://[tenant].sharepoint.com/sites/[site]/_layouts/15/workbench.aspx`

3.  **Add Web Part**:
    - Search for `PAP Checklist` in the web part toolbox.
    - Add it to the page.
    - It should load data from Dataverse immediately (using your logged-in SharePoint user).

---

## Troubleshooting

- **401/403 Error:**
    - Ensure you approved API permissions in SharePoint Admin Center.
    - Ensure your user has a security role in Dataverse.
- **Missing Columns:** Re-run the provisioning scripts (they are idempotent/skip existing).
- **Import Failures:** Check the import logs in Power Apps portal. Typically caused by lookup resolution failures (ensure names match exactly).
