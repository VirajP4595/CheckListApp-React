# PAP Checklist Application - User Guide

Welcome to the PAP Checklist Application! This guide covers all features for creating, managing, and exporting your construction estimator checklists.

---

## 1. Getting Started

### Accessing the App
Open your web browser (Chrome or Edge recommended) and navigate to the SharePoint page where the app is installed. You will be automatically logged in with your Microsoft account.

### The Dashboard
Once logged in, you will see the **Dashboard** — your home screen showing all active checklists.

Each checklist card shows:
- **Job Name & Number**
- **Job Type** (shown as a pill badge)
- **Status:** Draft, In Review, In Revision, or Final
- **Due Date** with urgency colouring (red if overdue, orange if due within 3 days)
- **Estimator** and **Reviewer** names
- **Last Modified** date

### Filtering & Searching
Use the filter bar at the top of the Dashboard to narrow down checklists:
- **Search** by job name or number
- **Filter by Status** (Draft, In Review, In Revision, Final)
- **Filter by Client**
- **Filter by Estimator** — select one or more lead estimators to see only their checklists

---

## 2. Creating a Checklist

### Ad-hoc Checklist Creation
To create a checklist outside of the automatic flow:
1. Click the **"Create Ad-hoc Checklist"** button in the Dashboard header.
2. Select the **Job Type** to filter available jobs.
3. Search for and select the **Job** from the dropdown.
4. Click **Create** — a Power Automate flow runs and the checklist will appear in the Dashboard within 1–2 minutes.

> **Note:** Checklists are normally created automatically when a new Job is added to Dataverse. The ad-hoc option is for cases where automatic creation did not occur.

---

## 3. Using the Checklist Editor

Click any checklist card to open the **Editor**.

### Document Layout

The checklist is organised into **Workgroups** (e.g., "20 Preliminaries", "40 Demolition"). Click a workgroup header to expand or collapse it.

Inside each workgroup, rows are grouped into two sub-sections:
- **Client Checklist** — items filled by the client or checklist filler
- **Estimator** — items filled by the estimator

### Answering Items

Each row has an answer selector with the following states:

| State | Meaning |
|-------|---------|
| **YES** | Item is included in the estimate |
| **NO** | Item is explicitly excluded from scope |
| **BLANK** | Intentionally unanswered |
| **PS** | Provisional Sum — a placeholder allowance |
| **PC** | Prime Cost — a specific cost allowance |
| **SUB** | Subquote / Subcontractor to supply |
| **OTS** | Owner to Supply |
| **TBC** | To Be Confirmed |
| **Optional Extra** | Optional scope item |
| **Builder Spec** | Builder specification or standard inclusion |
| **RFQ** | Request for Quote — prompts for **Supplier Name** and **Supplier Email** |

**Tip:** Click the active answer button again to toggle it off (returns to Blank).

### Row Notes & Descriptions
- **Notes field:** Click inside the notes area below any item to type assumptions, clarifications, or details. Notes appear in the PDF export.
- **Description:** Click the description area for rich-text editing (bold, lists, etc.).

### Row Flags

Each row has two optional flag icons on the right side:

- **BTC (Builder To Confirm)** — marks the item as needing builder confirmation. Flagged rows are included in the BTC export.
- **Notify Admin** — sends a notification email to the Super Admin group flagging this row for attention. A dialog lets you add context before sending.

### Adding & Managing Rows

- **Add Row to section:** Click the **"+ Add item"** button at the top of the Client Checklist or Estimator sub-section to append a new row to that section.
- **Insert Row:** Hover between any two rows to reveal a thin **"+ Add item"** divider. Click it to insert a new row at that exact position.
- **Reorder:** Click and drag the grip icon (⠿) on the left of a row to move it.
- **Delete:** Click the trash icon on a row to remove it permanently.

---

## 4. Working with Images

### Adding Images
1. **Drag and Drop:** Drag an image file from your computer onto a row.
2. **Copy and Paste:** Copy an image (e.g., from Snipping Tool) and paste (`Ctrl+V`) while focused on the row.

### Image Options
- **Caption:** Click below the image to add a caption.
- **View Full Size:** Click the image to see a larger version.
- **Remove:** Click the **×** on the image to delete it.

Images are automatically uploaded to SharePoint.

---

## 5. The Sidebar

Click the icons on the right sidebar to access:

| Icon | Panel | Purpose |
|------|-------|---------|
| ℹ️ Info | **Checklist Info** | Status, job details, client correspondence, export actions |
| 💬 Chat | **Comments** | Internal comment thread |
| 📎 Files | **Files** | File attachments (PDFs, Excel, Word, etc.) |
| ⚡ Activity | **Activity Log** | Change history timeline |
| 🕐 History | **Revision History** | Saved revision snapshots |
| ⭐ Branding | **Branding** | Upload client logo for PDF |

---

## 6. Checklist Status

Set the status via the **Checklist Info** panel:

| Status | Meaning |
|--------|---------|
| **Draft** | Work in progress |
| **In Review** | Submitted for reviewer approval |
| **In Revision** | Reviewer has sent it back for changes |
| **Final** | Approved and locked |

---

## 7. Revisions & History

Revisions are snapshots of the checklist at a point in time.

### Creating a Revision
1. Open the **Revision History** tab (clock icon).
2. Click **"New Revision"**.
3. Enter a brief title (e.g., "Initial Client Review").
4. Click **Create**.

The snapshot is permanently saved and viewable at any time.

---

## 8. Exporting

### Export to PDF
1. Open the **Checklist Info** panel (ℹ️ icon).
2. Click **"Export to PDF"**.
3. A progress modal will track image downloads and layout.
4. The PDF downloads automatically and a copy is saved to SharePoint.

The PDF includes: job details header, all workgroups with Client/Estimator section labels, answer states, notes, descriptions, supplier info for RFQ rows, and embedded images.

### Email BTC Summary
Sends an email to the admin team listing all rows flagged as **Builder To Confirm**.

1. Open the **Checklist Info** panel.
2. Click **"Email BTC Summary"**.

### Email RFQ Summary
Sends a PDF summary of all rows answered as **RFQ**, including supplier name and email.

1. Open the **Checklist Info** panel.
2. Click **"Email RFQ Summary"**.

---

## 9. Activity Log

The Activity Log tracks all changes, grouped by day.

1. Open the **Activity** tab (⚡ icon).
2. View a timeline showing the time, user, and description of each action.

Captured events include: row additions/updates/deletions, workgroup changes, file uploads/deletions, metadata edits, revision creation, and comments.

---

## 10. Managing Files & Attachments

### Uploading a File
1. Open the **Files** tab (📎 icon).
2. Click **"Click to Upload File"** and select a file.
3. The file uploads to SharePoint and appears in the list.

### Downloading or Deleting
- **Download:** Click the file name or download icon.
- **Delete:** Click the trash icon.

---

## 11. Super Admin Actions

Users in the **SP_Checklist_SuperAdmin** SharePoint group see additional controls:

- **Delete Checklist:** Permanently deletes the checklist, all workgroups, and all rows from Dataverse. A progress modal tracks the cascade. This action is irreversible.

---

## 12. Frequently Asked Questions

**Q: Do I need to click Save?**
A: No — the application auto-saves changes as you make them. An indicator in the top bar shows the save status.

**Q: What if I accidentally delete a row?**
A: Deleted rows are permanent. If you created a Revision recently, you can view the row data in the snapshot.

**Q: My images aren't loading?**
A: Ensure you have a stable connection. If an image is missing, it may have been deleted from SharePoint.

**Q: Can I work offline?**
A: No — an active internet connection is required to sync with Dataverse and SharePoint.

**Q: A checklist I created isn't showing up?**
A: If created via the automatic flow, allow 1–2 minutes. If using Ad-hoc creation, check that the Power Automate flow ran successfully.

**Q: I can't see the Delete button for a checklist?**
A: Delete is only available to users in the `SP_Checklist_SuperAdmin` SharePoint group. Contact your administrator.
