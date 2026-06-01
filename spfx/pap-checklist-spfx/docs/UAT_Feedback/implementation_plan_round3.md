# UAT Round 3 — RFQ Enhancements: Implementation Plan & Summary

**Last Updated**: 2026-04-26
**Status**: Code complete — pending Dataverse schema rollout, shared-mailbox permission grant, and on-tenant QA
**Branch**: `Production` (all RFQ work lives here, not `main`)

---

## Overview

Three enhancements to the existing Request-for-Quote flow so estimators can send polished, supplier-ready emails directly from the app.

| # | Feature | Effort | Dataverse Change? | Status |
|---|---------|--------|:-:|:-:|
| 1 | "Specified By" field on RFQ rows | Small | Yes (`pap_specifiedby`) | ✅ Code done |
| 2 | Fillable line-item table inside Notes (RFQ rows only) | Large | Yes (`pap_rfqlineitems`) | ✅ Code done |
| 3 | Per-supplier automated email from shared mailbox with templated body and supplier-scoped PDF attachment | Large | No | ✅ Code done |

---

## 1. "Specified By" field

### What
A new free-text input ("Specified By:") sits to the right of `Supplier Email` on RFQ rows. Captures who specified the product (architect, client, builder, etc.) and is merged into the supplier email body.

### Data model
- `ChecklistRow.specifiedBy?: string` added to `src/models/index.ts`.
- Dataverse column `pap_specifiedby` (string, 200) on `pap_checklistrows`.
- Read/write mapped in `dataverseChecklistService.ts` (`mapRow`, `createRow`, `updateRow`, `$select`).

### UI
- Third input added inside the existing RFQ-visible block in `ChecklistRowItem.tsx`.
- Same debounced save pattern as `supplierName` / `supplierEmail` — no new save path.

---

## 2. Fillable RFQ line-item table

### What
When a row's answer is `RFQ`, a 5-column blue-headed table appears below the row's images: **Item No. / Description / Image / Qty / Unit** plus row actions (delete, reorder). Estimators add line items inline; the Image cell opens a picker that lists images already attached to the row, and binds the selected `ChecklistImage.id` to the line item.

### Data model
```ts
interface RfqLineItem {
  id: string;          // uuid
  itemNo: string;      // free-text, auto-incremented on add
  description: string;
  qty: string;
  unit: string;
  imageId?: string;    // references ChecklistImage.id on the same row
}

// On ChecklistRow
rfqLineItems?: RfqLineItem[];
```
- Persisted as JSON in new Dataverse column `pap_rfqlineitems` (memo / multi-line text) on `pap_checklistrows`.
- `dataverseChecklistService.parseRfqLineItems()` hydrates safely (defensive against malformed JSON / missing fields).

### Components (new)
- `src/components/Editor/RfqLineItemTable.tsx`
- `src/components/Editor/RfqLineItemTable.module.scss`

Rendered conditionally (`row.answer === 'RFQ'`) inside `ChecklistRowItem.tsx`.

### Image handling
1. Estimator uploads images via existing `ChecklistImage` flow — unchanged.
2. Image cell opens a Fluent Dialog showing thumbnails of the row's images. Clicking one writes its `id` into `rfqLineItem.imageId`.
3. Only the **reference** is stored — image bytes live once on the row, can be reused across multiple line items.
4. PDF rendering looks the image up at export time; missing reference → blank cell + console warning.

---

## 3. Automated supplier email

### What
The old "Email RFQ" button is replaced with **Send RFQ to Suppliers**. Clicking it:
1. Hydrates the checklist, filters to RFQ rows, groups by normalized supplier email.
2. Shows a preview Dialog: _"Ready to send N emails to N suppliers. P rows will be skipped (no email)."_ with a recipient list.
3. On confirm, sends one email per unique supplier from the shared mailbox `estimates@priceaplan.com.au`, each carrying a supplier-scoped PDF (only that supplier's items).
4. Shows a result Dialog with sent/failed counts and per-failure reasons.

### Sender / transport
- Microsoft Graph delegated `POST /users/estimates@priceaplan.com.au/sendMail` via `GraphEmailService.sendEmail`.
- `EmailMessagePayload.senderMailbox` switches the endpoint between `/me/sendMail` and `/users/{mailbox}/sendMail`.
- Mailbox configured in `src/config/environment.ts` → `AppConfig.admin.rfqSenderMailbox`.

### Template (HTML body)
```
Subject: Request for Quote

Hi {{supplierName}},

Price A Plan is a residential estimating company and we are completing a tender on behalf of {{buildersName}} of {{accountName}} with the following details:

Product Specified by: {{specifiedBy}}
Job Address: {{jobName}}

Please find attached a pdf with all the specified items we require quotes, and please include any shipping costs should this apply.

Please reply to this email with your quote, or for any further product follow-up questions.

To confirm if the job proceeds, please reach out to the builder.

If you require anything further please reply to us to ask.

Regards,
Price A Plan Estimating Team
```
HTML-escaped server-side. Missing tokens fall back to empty string + console warning rather than blocking the send.

### Token sources
| Token | Source |
|-------|--------|
| supplierName  | `row.supplierName` (first non-empty in group) |
| buildersName  | `checklist.jobDetails.builderName` |
| accountName   | `checklist.jobDetails.clientName` |
| specifiedBy   | `row.specifiedBy` (first non-empty in group) |
| jobName       | `checklist.jobDetails.jobName` (or `siteAddress` / `title` fallback) |

### Per-supplier PDF
- Built **inside `RfqExportService.buildSupplierRfqPdf`** using jsPDF + `jspdf-autotable` directly.
- **`PdfGeneratorService.ts` is NOT modified** — the standard "Export PDF" path stays untouched.
- Layout: PAP-blue header banner, supplier/job metadata, then one 5-column autotable per row with the line items.
- Image column is left blank in autotable, then `addImage` is called inside the `didDrawCell` hook to overlay the picture (lookup via `imageId` → `row.images`).
- Rows without `rfqLineItems` fall back to a single synthesized line item so legacy data still produces a usable PDF.
- Attached as `RFQ - {{jobName}}.pdf` (sanitized).

### Per-supplier loop
- `RfqExportService.sendRfqEmailsPerSupplier` walks groups sequentially, collecting per-supplier success/failure into a `SendRfqSummary`. Individual supplier failures do not abort the batch.

---

## Files changed

**Modified**
- `src/models/index.ts`
- `src/services/dataverseChecklistService.ts`
- `src/services/RfqExportService.ts` (rewritten — all new PDF + grouping + send logic lives here)
- `src/services/graphEmailService.ts` (added `senderMailbox` switch)
- `src/hooks/useRfqExport.ts` (replaced legacy email path with `previewRfqSend` + `sendRfqToSuppliers`)
- `src/components/Editor/ChecklistRowItem.tsx` (Specified By input + conditional `RfqLineItemTable`)
- `src/components/Editor/Sidebar/ChecklistInfoPanel.tsx` (Send RFQ button + preview & result Dialogs)
- `src/config/environment.ts` (`admin.rfqSenderMailbox`)

**New**
- `src/components/Editor/RfqLineItemTable.tsx`
- `src/components/Editor/RfqLineItemTable.module.scss`

**Untouched (deliberately)**
- `src/services/PdfGeneratorService.ts` — standard PDF export path remains.

---

## Pre-deployment checklist

1. **Dataverse**
   - Add column `pap_specifiedby` (Text, 200) to `pap_checklistrows`.
   - Add column `pap_rfqlineitems` (Multiline Text, 100k) to `pap_checklistrows`.
   - Publish the updated solution to Production.

2. **Exchange / Graph permissions**
   - Grant the estimator security group **Send-As** (or **Send-On-Behalf**) on `estimates@priceaplan.com.au`.
   - Confirm the SPFx Graph permission set already allows `Mail.Send` (delegated). The shared-mailbox endpoint piggybacks on that scope when Send-As is configured at the Exchange level — no manifest change required.

3. **Build**
   - `cd spfx/pap-checklist-spfx && npm run build` — clean.
   - `npx tsc --noEmit` — passes (verified).

---

## Manual verification plan

| Scenario | Expected |
|---|---|
| Set a row to `RFQ`, fill Supplier Name / Email / Specified By, save, reload | All three values persist |
| Add 2 line items to an RFQ row (one with image, one without), save, reload | Both rows + image binding survive |
| Click **Send RFQ to Suppliers** with two distinct supplier emails | Preview Dialog shows 2 recipients; on confirm each supplier receives only their own items in a PDF, From = `estimates@priceaplan.com.au` |
| Row with blank/invalid supplier email | Counted under "P rows will be skipped"; other sends proceed |
| Non-RFQ row | Notes editor unchanged, no line-item table visible |
| Existing checklists (no `rfqLineItems`) | Per-supplier PDF still renders (fallback line item) |
| Standard "Export to PDF" button | Unchanged behaviour (PdfGeneratorService untouched) |

---

## Out of scope (future rounds)

- Tracking supplier responses / quote status inside the app
- Bounce handling beyond Graph's immediate response
- Bulk-editing line items across multiple RFQ rows
