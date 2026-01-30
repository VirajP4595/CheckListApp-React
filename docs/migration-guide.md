# PAP Checklist - Production Migration & Deployment Guide

This guide details the end-to-end process for deploying the PAP Checklist Solution to a new tenant (e.g., Production).

---

## 1. Prerequisites

- **Access**: Global Administrator or Power Platform Administrator access to the target tenant.
- **Tools**: 
  - PowerShell 7+
  - Node.js (v18+) & NPM
  - Azure CLI (`az login`)
  - PnP PowerShell (`Connect-PnPOnline`)

---

## 2. Azure AD App Registration

This application runs as a Single Page Application (SPA) and requires an App Registration to authenticate against Dataverse and SharePoint.

1.  **Navigate** to [Azure Portal](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps) > App Registrations.
2.  **Click** "New Registration".
3.  **Details**:
    - **Name**: `PAP Checklist Production` (or similar)
    - **Account Type**: Single Tenant (Accounts in this organizational directory only).
    - **Redirect URI**: 
      - Platform: **Single-page application (SPA)**.
      - URI: Enter your production URL (e.g., `https://checklist.pap.com` or `https://[org].sharepoint.com` if embedding).
      - *Note*: You can add `http://localhost:3000` or `http://localhost:5173` for testing, but ensure the Production URL is added.
4.  **Register**.
5.  **Copy IDs**:
    - **Application (client) ID**
    - **Directory (tenant) ID**
6.  **API Permissions**:
    - Click **API permissions** > **Add a permission**.
    - **Dynamics CRM (Dataverse)**: Check `user_impersonation` (Delegated).
    - **Microsoft Graph**: Check `User.Read` and `Sites.ReadWrite.All` (Delegated).
    - **Grant Admin Consent**: Click "Grant admin consent for [Org]" to authorize these permissions.

---

## 3. Dataverse Environment Setup

Provisions the database tables (`pap_checklist`, `pap_workgroup` etc.).

1.  **Open Terminal** (PowerShell).
2.  **Authenticate**:
    ```powershell
    # Login to Azure CLI (required by script)
    az login --allow-no-subscriptions
    ```
3.  **Run Provisioning Script**:
    ```powershell
    cd scripts
    .\provision-dataverse-api.ps1 -EnvironmentUrl "https://[prod-org].crm.dynamics.com"
    ```
    - *Verify*: Script should output "Provisioning Logic Complete!" with no red errors.
4.  **Seed Default Data**:
    - This creates the 144+ standard workgroups and default rows.
    ```powershell
    .\seed-default-data.ps1 -EnvironmentUrl "https://[prod-org].crm.dynamics.com"
    ```
    - *Verify*: Script counts through items and confirms creation.

---

## 4. SharePoint Environment Setup

Provisions the document library for attachments.

1.  **Create Site**: Create a Team Site in SharePoint (e.g., `https://[tenant].sharepoint.com/sites/PAPChecklist`).
2.  **Run Provisioning Script**:
    ```powershell
    .\provision-sharepoint.ps1 -SiteUrl "https://[tenant].sharepoint.com/sites/PAPChecklist"
    ```
    - *Verify*: "PAP Attachments" library created with metadata columns.

---

## 5. Power Automate Configuration

You must manually create the flow to auto-generate checklists when a Job is created.

**Flow Name**: `PAP - Auto-Create Checklist`

1.  **Trigger**: `Dataverse - When a row is added, modified or deleted`
    - **Change Type**: `Added`
    - **Table**: `Jobs` (`pap_jobs`)
    - **Scope**: `Organization`

2.  **Action**: `Dataverse - Add a new row` (Create Checklist)
    - **Table**: `Checklists` (`pap_checklists`)
    - **Name**: `@{triggerBody()?['pap_name']} Checklist`
    - **Job (Checklist -> Job)**: `pap_jobs(@{triggerBody()?['pap_jobid']})`
    - **Status**: `1` (Draft)
    - **Current Revision**: `0`

3.  **Action**: `Dataverse - List rows` (Get Templates)
    - **Table**: `Default Workgroups`
    - **Filter Logic**: `pap_isactive eq true`
    - **Sort By**: `pap_order asc`

4.  **Loop**: `Apply to each` (on Default Workgroups value)
    - **Action**: `Dataverse - Add a new row` (Create Workgroup)
        - **Table**: `Workgroups`
        - **Name**: `@{item()?['pap_name']}`
        - **Number**: `@{item()?['pap_number']}`
        - **Checklist (Bind)**: `pap_checklists(@{outputs('Create_Checklist')?['body/pap_checklistid']})`
        
    - **Action**: `Dataverse - List rows` (Get Default Rows)
        - **Table**: `Default Rows`
        - **Filter**: `_pap_defaultworkgroupid_value eq @{item()?['pap_defaultworkgroupid']}`

    - **Loop**: `Apply to each` (on Default Rows value)
        - **Action**: `Dataverse - Add a new row` (Create Row)
            - **Table**: `Checklist Rows`
            - **Item Name**: `@{item()?['pap_description_primary']}`
            - **Description**: `@{item()?['pap_description']}`
            - **Workgroup (Bind)**: `pap_workgroups(@{outputs('Create_Workgroup')?['body/pap_workgroupid']})`

*Refer to `docs/auto_creation_flow.md` for granular details if needed.*

---

## 6. Application Configuration & Build

Before building the frontend, you must point it to the production environment.

1.  **Edit Configuration**:
    - Open `src/config/environment.ts`.
    - Update the **AppConfig** object with Production values:
      ```typescript
      export const AppConfig = {
          dataverse: {
              url: "https://[prod-org].crm.dynamics.com", // UPDATE THIS
              apiPath: "/api/data/v9.2",
              publisherPrefix: "pap_"
          },
          sharepoint: {
              siteUrl: "https://[tenant].sharepoint.com/sites/PAPChecklist", // UPDATE THIS
              documentLibrary: "PAPAttachments"
          },
          auth: {
              clientId: "[PROD_CLIENT_ID_FROM_STEP_2]", // UPDATE THIS
              tenantId: "[PROD_TENANT_ID]", // UPDATE THIS
              authority: "https://login.microsoftonline.com/[PROD_TENANT_ID]",
              redirectUri: "https://[your-production-url]", // UPDATE THIS
              scopes: { 
                  // ... keep existing scopes
              }
          }
      };
      ```

2.  **Build**:
    ```bash
    npm install
    npm run build
    ```
    - This generates a `dist` folder containing the optimized application.

3.  **Deploy**:
    - Host the contents of the `dist` folder on your web server, Azure Static Web App, or verify embedding method if using SharePoint pages.

---

## 7. Verification

1.  **Login**: Access the Production App URL. Login should succeed via Azure AD.
2.  **Data Load**: Dashboard should load (likely empty initially).
3.  **Test Flow**: Create a new Job in the Dataverse/Dynamics Model-driven app.
    - Wait > Refresh Dashboard.
    - Validate a new Checklist appears.
4.  **Test Upload**: Open checklist > Upload an image.
    - Verify it appears in the SharePoint "PAP Attachments" library.

---

**Troubleshooting**
- **401 Unauthorized**: Check Azure AD App permissions and verify Admin Consent was granted.
- **403 Forbidden**: Ensure the logged-in user has a Security Role in Dataverse allowing read/write to `pap_` tables.
- **Flow Fails**: Check Run History in Power Automate. Common error is missing `bind` syntax for lookups (e.g., `pap_jobs(...)`).
