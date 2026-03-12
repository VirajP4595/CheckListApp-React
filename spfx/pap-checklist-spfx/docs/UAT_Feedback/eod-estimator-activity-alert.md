# Power Automate Flow: EOD Estimator Activity Alert

Send a daily end-of-day email to the Lead Estimator summarizing all checklist activity for that day. Only triggers for checklists in **Draft** or **In Review** status that have activity logged for the current day.

---

## Trigger

**Recurrence** — Schedule daily (e.g., 5:00 PM AEST).

---

## Flow Steps

### 1. List Active Checklists

**Dataverse → List rows** from `pap_checklists`

| Setting | Value |
| :--- | :--- |
| Filter | `pap_status eq 1 or pap_status eq 2` *(Draft / In Review)* |
| Expand | `pap_jobid($select=vin_name,_vin_account_value,vin_jobnumber,_vin_estimator_value)` |

---

### 2. For Each Checklist → Get Today's Activity Log

**Dataverse → List rows** from `pap_activitylogs`

| Setting | Value |
| :--- | :--- |
| Filter | `_pap_checklistid_value eq '<checklist ID>' and pap_date eq '<today YYYY-MM-DD>'` |
| Select | `pap_entries, pap_date` |

---

### 3. Condition: Activity Exists?

Check: `length(body('List_Activity_Logs')?['value']) > 0`

- **If No** → Skip (no activity today for this checklist).
- **If Yes** → Continue to build the email.

---

### 4. Parse the `pap_entries` JSON

The `pap_entries` column stores a JSON array. Use **Parse JSON** with this schema:

```json
{
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "user":   { "type": "string" },
            "action": { "type": "string" },
            "detail": { "type": "string" }
        }
    }
}
```

### 5. Build the Email Body (HTML Table)

To convert the JSON `action` keys (like `row_updated`) into friendly text and format them nicely, use a String Variable and a Loop.

1. **Initialize variable** (Place before the loop)
   - **Name:** `HTMLTableRows`
   - **Type:** `String`
   - **Value:** *(leave blank)*

2. **Apply to each** loop
   - **Input:** Use the `Body` dynamic content from the **Parse JSON** step.

3. **Switch** action (Inside the loop)
   - **On:** Select `action` from the Parse JSON dynamic content to check what the user did.

4. **Append HTML** (Inside each Switch Case)
   - Add a **Case** for each of the action keys below.
   - Inside each Case, add an **Append to string variable** action pointing to `HTMLTableRows`, using the provided HTML snippet.

   ***

   **Case: `row_updated`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Updated rows in @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `row_added`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Added rows to @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `row_deleted`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Deleted rows from @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `workgroup_added`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Added workgroup @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `workgroup_deleted`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Deleted workgroup @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `common_notes_updated`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Modified common notes</td>
   </tr>
   ```

   **Case: `checklist_metadata_updated`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Updated checklist details</td>
   </tr>
   ```

   **Case: `revision_created`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Created revision @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `file_uploaded`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Uploaded file @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `file_deleted`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Deleted file @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   **Case: `comment_added`**
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Added a comment</td>
   </tr>
   ```


### 6. Resolve Estimator Email

The estimator is a lookup on the Job entity: `_vin_estimator_value`.

**Dataverse → Get a row** from `systemusers`:
- ID: `_vin_estimator_value` from the expanded Job
- Select: `internalemailaddress`

---

### 7. Send Email

**Office 365 Outlook → Send an email (V2)**

**To:** `outputs('Get_a_row')?['body/internalemailaddress']` *(the email resolved in Step 6)*
**Subject:** `📋 PAP Checklist Activity — @{outputs('Get_Job_Details')?['vin_name']} (@{outputs('Get_Job_Details')?['vin_jobnumber']}) — @{utcNow('dd MMM yyyy')}`

**Body:** 
Click the `</>` (Code View) button in the Power Automate email body field and paste the following HTML structure. Notice where the `@{variables('HTMLTableRows')}` is injected.

```html
<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #323130; max-width: 600px; margin: 0 auto; border: 1px solid #e1dfdd; border-radius: 4px; overflow: hidden;">
    <div style="background-color: #0078d4; padding: 16px 24px;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600;">📋 Today's Checklist Activity</h2>
    </div>
    
    <div style="padding: 24px;">
        <p style="margin-top: 0; margin-bottom: 16px; font-size: 15px;">
            The following updates occurred today on <strong>@{outputs('Get_Job_Details')?['vin_name']}</strong> (@{outputs('Get_Job_Details')?['vin_jobnumber']}):
        </p>

        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px;">
            <thead>
                <tr style="background-color: #f3f2f1; text-align: left; border-bottom: 2px solid #ccc;">
                    <th style="padding: 10px 12px; font-weight: 600; width: 35%;">Team Member</th>
                    <th style="padding: 10px 12px; font-weight: 600;">Activity Summary</th>
                </tr>
            </thead>
            <tbody>
                <!-- INJECT THE LOOPED VARIABLE HERE -->
                @{variables('HTMLTableRows')}
            </tbody>
        </table>
        
        <p style="margin-top: 32px; font-size: 13px; color: #605e5c; border-top: 1px solid #e1dfdd; padding-top: 16px;">
            This is an automated digest sent from the PAP Checklist application.
            <br/>
            Checklist Status: <strong>@{outputs('List_Active_Checklists')?['pap_status@OData.Community.Display.V1.FormattedValue']}</strong>
        </p>
    </div>
</div>
```
---

## Dataverse Tables & Columns Referenced

| Table | Column | Purpose |
| :--- | :--- | :--- |
| `pap_checklists` | `pap_status` | Filter for Draft / In Review |
| `pap_checklists` | `pap_checklistid` | Link to activity logs |
| `pap_checklists` | `pap_name` | Checklist title for email |
| `pap_checklists` → expand `pap_jobid` | `vin_name`, `vin_jobnumber` | Job context for email |
| `pap_checklists` → expand `pap_jobid` | `_vin_estimator_value` | Resolve estimator user |
| `pap_activitylogs` | `pap_date` | Filter for today |
| `pap_activitylogs` | `pap_entries` | JSON array of activity entries |
| `systemusers` | `internalemailaddress` | Estimator's email address |
