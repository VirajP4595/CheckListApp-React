# PAP Checklist - Production Migration & Deployment Guide (SPFx)

This guide details the end-to-end process for deploying the PAP Checklist SPFx Solution to a new tenant (e.g., Production).

---

## 1. Prerequisites

- **Access**: Global Administrator or SharePoint Administrator access to the target tenant.
- **Tools**: 
  - Node.js (v18+) & NPM
  - PowerShell 7+
  - Azure CLI (`az login`)
  - PnP PowerShell (`Connect-PnPOnline`)

---

## 2. Prepare for Production Build

Before building, ensure the configuration points to the Production environment.

### 2.1 Update Configuration
1.  Open `src/config/environment.ts`.
2.  Update **AppConfig**:
    ```typescript
    export const AppConfig = {
        dataverse: {
            url: "https://[prod-org].crm.dynamics.com", // Production Dataverse URL
            apiPath: "/api/data/v9.2",
            publisherPrefix: "pap_"
        },
        sharepoint: {
            absoluteUrl: "https://[tenant].sharepoint.com/sites/PAPChecklistProd", // Production Site
            documentLibrary: "PAPAttachments"
        }
    };
    ```

### 2.2 Versioning (Optional)
1.  Open `config/package-solution.json`.
2.  Increment the `version` number (e.g., `1.0.0.1` -> `1.0.0.2`).

---

## 3. Build & Package

Run the following commands in the `spfx/pap-checklist-spfx` directory:

```powershell
# 1. Clean previous builds
npm run clean

# 2. Build for Production (this uses 'heft' under the hood)
npm run build
# Note: In standard SPFx this might be 'gulp bundle --ship' + 'gulp package-solution --ship'.
# But in this project, 'npm run build' handles the production build.
```

**Output**: verify the file `sharepoint/solution/pap-checklist-spfx.sppkg` exists.

---

## 4. Deploy to App Catalog

1.  Navigate to the **SharePoint Admin Center** (`https://[tenant]-admin.sharepoint.com`).
2.  Go to **Apps** (App Catalog).
3.  **Upload** the `.sppkg` file.
4.  **Enable**:
    - Select "Enable this app and add it to all sites" (if desired).
    - Click **Enable**.

---

## 5. API Permissions

The solution requests permissions to **Microsoft Graph** and **Dataverse**. These must be approved by an admin.

1.  In SharePoint Admin Center, go to **Advanced** -> **API access**.
2.  Look for "Pending requests" from `pap-checklist-spfx-client-side-solution`.
3.  Select and **Approve** requests for:
    - Microsoft Graph: `Sites.ReadWrite.All`
    - Dataverse: `user_impersonation`

---

## 6. Environment Provisioning

Run these scripts against the **Production** environment.

### 6.1 Dataverse Setup
```powershell
# Login to Azure CLI
az login --allow-no-subscriptions

# Run Script
cd scripts
.\provision-dataverse-api.ps1 -EnvironmentUrl "https://[prod-org].crm.dynamics.com"
```

### 6.2 SharePoint Setup
```powershell
# Create the site FIRST if it doesn't exist
.\provision-sharepoint.ps1 -SiteUrl "https://[tenant].sharepoint.com/sites/PAPChecklistProd"
```

### 6.3 Seed Data
```powershell
.\seed-default-data.ps1 -EnvironmentUrl "https://[prod-org].crm.dynamics.com"
```

---

## 7. Power Automate (Manual Step)

You must manually import or recreate the "Auto-Create Checklist" flow in the Production environment.

1.  **Export** the solution from Dev (if available) or recreate manually.
2.  **Import** to Prod.
3.  **Update Connections**: Ensure Dataverse connections point to Prod.
4.  **Turn On** the flow.

---

## 8. Verification

1.  Navigate to a SharePoint page on the Prod site.
2.  Add the **PAP Checklist** web part.
3.  Login (if prompted).
4.  Verify you can create a checklist and upload files.

---

## Troubleshooting

- **App not loading**: Check browser console. If 403 Forbidden on Dataverse calls, check API Permission approval and User Security Roles.
- **File Upload Errors**: Ensure the "PAP Attachments" library exists on the site where the web part is running (or the site configured in `environment.ts`).

