# Checklist Card — Data Mapping Table

Maps each UI field on the Dashboard's `ChecklistCard` to its source Dataverse table and column.

## Primary Entity: `pap_checklists`

| UI Field | Dataverse Column | Notes |
| :--- | :--- | :--- |
| **Title** | `pap_name` | Main checklist name |
| **Job Reference / ID** | `_pap_jobid_value` | GUID reference to associated Job |
| **Status Badge** | `pap_status` | OptionSet → Draft (1), In Review (2), Final (3) |
| **Revision Pill (REV)** | `pap_currentrevisionnumber` | Integer revision count |
| **Updated Date** | `modifiedon` | Auto-generated, formatted `dd MMM yyyy` |
| **Estimate Type** | `pap_estimatetype` | JSON string array, joined by commas |
| **Correspondence** | `pap_clientcorrespondence` | JSON string array, joined by commas |

## Expanded Entity: `pap_jobid` (Job Lookup)

| UI Field | Dataverse Column | Notes |
| :--- | :--- | :--- |
| **Job Type Badge** | `vin_jobtype` | Uses `FormattedValue` (OptionSet display name) |
| **Client Name** | `_vin_account_value` | Uses `FormattedValue` (Account name) |
| **Job Number** | `vin_jobnumber` | Prepended before Job Name if exists |
| **Job Name** | `vin_name` | Full job title |
| **Lead Estimator** | `_vin_estimator_value` | Uses `FormattedValue` (User full name) |
| **Reviewer** | `_ownerid_value` | Uses `FormattedValue` (User full name) |
| **Due Date** | `vin_duedate` | Used to calculate urgency (Urgent/Overdue/Normal) |

> **Note:** Job fields are retrieved via OData `$expand=pap_jobid(...)` when fetching checklists.
