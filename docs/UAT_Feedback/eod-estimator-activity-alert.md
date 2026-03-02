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
   - Add a Case for the actions you care about (e.g., `row_updated`, `revision_created`).
   - Inside each Case, add an **Append to string variable** action pointing to `HTMLTableRows`.

   *Example for `row_updated` Case:*
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Updated rows in @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

   *Example for `revision_created` Case:*
   ```html
   <tr style="border-bottom: 1px solid #e1dfdd;">
     <td style="padding: 12px 8px;"><strong>@{items('Apply_to_each')?['user']}</strong></td>
     <td style="padding: 12px 8px; color: #605e5c;">Created revision @{items('Apply_to_each')?['detail']}</td>
   </tr>
   ```

---

### 6. Resolve Estimator Email

The estimator is a lookup on the Job entity: `_vin_estimator_value`.

**Dataverse → Get a row** from `systemusers`:
- ID: `_vin_estimator_value` from the expanded Job
- Select: `internalemailaddress`

---

### 7. Send Email

**Office 365 Outlook → Send an email (V2)**

| Field | Value |
| :--- | :--- |
| **To** | Estimator's email (from step 6) |
| **Subject** | `📋 PAP Checklist Activity — {Job Name} ({Job Number}) — {today's date}` |
| **Body** | HTML table from step 5 wrapped in a styled email template |

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
