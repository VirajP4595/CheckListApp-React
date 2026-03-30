# PDF Export & Preview Performance Optimization Plan

**Status:** 🟡 Planned — Ready for implementation
**Date:** 2026-03-28

---

## Context

Users report PDF export and preview are slow. For a large checklist (144 workgroups × 3-4 rows × 50-100 images) the pipeline takes 20-30+ seconds. Three independent bottlenecks were identified:

1. **Image hydration uses Graph API one-at-a-time** — `getHydratedChecklist()` calls `downloadImageContent(id)` per image (5 concurrent, sequential chunks). Each call is a Graph `/drives/{id}/items/{id}/content` request.
2. **`getImageProperties()` is sequential** — PdfGeneratorService loads each image into an `<img>` element one at a time.
3. **Preview always re-downloads** — `handleViewPreview` calls `getHydratedChecklist()` even when images are already in the store.

---

## Throttling Research (via Microsoft Docs)

Relevant SharePoint/Graph throttling limits confirmed from [SharePoint throttling docs](https://learn.microsoft.com/en-us/sharepoint/dev/general-development/how-to-avoid-getting-throttled-or-blocked-in-sharepoint-online):

| Limit | Value |
|---|---|
| User requests | 3,000 per 5 min |
| App resource units (small tenant, per min) | 1,250 RU/min |
| File download via Graph `/content` | 1 RU per request |
| `@microsoft.graph.downloadUrl` fetches | **Not counted — goes to Azure Blob Storage directly** |

**Key insight:** `@microsoft.graph.downloadUrl` is a pre-signed Azure Blob Storage URL. Fetching it with a plain `fetch()` call bypasses the Graph API and SharePoint throttling entirely — no resource units consumed, no rate limit risk.

**Why `downloadImagesBatch()` is NOT the solution:** Graph `$batch` with `/content` endpoints is unreliable for binary — returns empty body on 302 redirects (confirmed by MS Q&A). Each request in a `$batch` still counts individually against throttling quotas anyway.

---

## Root Cause: `getAllImageMetadata()` Loses the Pre-Signed URL

When `getHydratedChecklist()` loads image metadata via `getAllImageMetadata()` ([sharePointService.ts:208-241](../../../src/services/sharePointService.ts)), `source` is set to:

```
https://[tenant].sharepoint.com/_layouts/15/download.aspx?UniqueId={driveItemId}
```

This is a SharePoint-authenticated URL, NOT a pre-signed Azure URL. So `downloadImageContent()` must use the Graph SDK (with auth) to fetch binary content — burning resource units and requiring sequential processing.

By contrast, `getRowImages()` ([sharePointService.ts:136-168](../../../src/services/sharePointService.ts)) already requests `@microsoft.graph.downloadUrl` in the Graph select and stores it as `source`. Images loaded lazily in the editor already have the pre-signed URL.

---

## Fix 1 — Upgrade `getAllImageMetadata()` to Return Pre-Signed URLs + Direct Fetch in Hydration

This is a two-part change.

### Part A — `sharePointService.ts`: Request `@microsoft.graph.downloadUrl` in the driveItem expand

**File:** `src/services/sharePointService.ts`, line 218

Change the `driveItem` expand to not restrict `$select` so the pre-signed URL annotation is included:

```typescript
// BEFORE (line 218):
.expand('fields($select=Checklist_x0020_ID,Row_x0020_ID,Caption),driveItem($select=id)')

// AFTER: Remove $select restriction on driveItem so @microsoft.graph.downloadUrl is returned
.expand('fields($select=Checklist_x0020_ID,Row_x0020_ID,Caption),driveItem($select=id,name)')
```

And update the mapping (lines 226-235) to use the download URL if available:

```typescript
return {
    id: driveItemId,
    rowId: fields?.Row_x0020_ID || '',
    caption: fields?.Caption || fields?.Title || '',
    // Use pre-signed Azure URL if present; fall back to /_layouts URL
    source: item.driveItem?.['@microsoft.graph.downloadUrl']
        || `${AppConfig.sharepoint.absoluteUrl}/_layouts/15/download.aspx?UniqueId=${driveItemId}`,
    order: 0
};
```

> **Note:** `@microsoft.graph.downloadUrl` is a Graph OData annotation. Whether it is returned in `$expand=driveItem` depends on the Graph SDK version and tenant config. **Test this first.** If it doesn't appear in the expand response, use Part C below as an alternative.

### Part B — `dataverseChecklistService.ts`: Fetch Pre-Signed URLs Directly, With Controlled Concurrency

**File:** `src/services/dataverseChecklistService.ts`, lines 416-440

Replace the chunked-5 loop with a helper that:
1. Uses `fetch(source)` directly when `source` is a pre-signed Azure URL (bypasses Graph, no throttling)
2. Falls back to `downloadImageContent(id)` if the URL is a SharePoint `/_layouts` URL or the fetch fails
3. Caps concurrency at **15** to be safe across tenant sizes and avoid browser connection pool saturation
4. Respects `Retry-After` on 429 responses

```typescript
// Helper to convert blob to base64 data URL
const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });

// Helper: download one image, preferring the pre-signed URL over Graph API
const downloadImage = async (item: { img: any; id: string }): Promise<void> => {
    const src: string = item.img.source || '';
    // If source is a pre-signed Azure URL (not a /_layouts URL), fetch directly
    // This bypasses Graph throttling entirely
    if (src && src.startsWith('https://') && !src.includes('/_layouts/')) {
        try {
            const r = await fetch(src);
            if (r.ok) {
                item.img.source = await blobToBase64(await r.blob());
                return;
            }
            // URL may have expired — fall through to Graph API below
        } catch { /* fall through */ }
    }
    // Fallback: use Graph API (authenticated, counts as 1 RU)
    const base64 = await imageService.downloadImageContent(item.id);
    if (base64) item.img.source = base64;
};

// Controlled concurrency — 15 simultaneous downloads, safe within throttling limits
// (100 images = 100 RU total = 8% of 1-min budget for smallest tenant)
const CONCURRENCY = 15;
let completed = 0;
const queue = [...allImages];

const runWorker = async (): Promise<void> => {
    while (queue.length > 0) {
        const item = queue.shift()!;
        try {
            await downloadImage(item);
        } catch (e) {
            console.warn(`[Hydration] Failed to download image ${item.id}`, e);
        } finally {
            completed++;
            if (onProgress) {
                const percent = 10 + Math.floor((completed / batchSize) * 85);
                onProgress(`Hydrated ${completed}/${batchSize} images...`, percent);
            }
        }
    }
};

// Run CONCURRENCY workers in parallel
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allImages.length) }, runWorker));
```

**Why concurrency 15 and not unlimited:**
- Safe within documented user limit (3,000 req/5 min) even for burst
- For large checklists (1,000+ images), unlimited parallel Graph requests could hit the 1,250 RU/min app limit. At 15 concurrent with ~300ms each, throughput is ~50 req/sec → throttling risk. But with pre-signed URL path (Part A), most images bypass Graph entirely — the 15 cap only matters for fallbacks.
- Avoids browser HTTP/2 connection pool saturation (typically 6-10 connections per origin)

### Part C — Alternative if `@microsoft.graph.downloadUrl` doesn't appear in expand

If Part A fails to get pre-signed URLs via expand, use a **metadata-only `$batch`** to get download URLs for all image IDs in one call, then `fetch()` those URLs directly:

```typescript
// After loading allImages (line 411), get pre-signed URLs for all in one $batch
// Each batch request is GET /drives/{driveId}/items/{id}?$select=@microsoft.graph.downloadUrl
// 20 items per $batch call. Response is JSON with downloadUrl annotation.
// Then fetch those URLs with Promise.all — no throttling risk since they're Azure storage URLs.
```

This approach is: 1 `$batch` call (for metadata) + N parallel Azure storage `fetch()` calls = maximum 5-6 Graph requests total for 100 images.

---

## Fix 2 — Parallelize `getImageProperties()` in PdfGeneratorService

**File:** `src/services/PdfGeneratorService.ts`, lines 290-310

Replace the sequential `for` loop with `Promise.all`.

```typescript
// REPLACE lines 290-310:
const loadedImages = (await Promise.all(
    workgroupImages.map(async (item) => {
        try {
            let d = item.data;
            if (d.startsWith('http') || d.startsWith('blob:')) {
                const r = await fetch(d).catch(() => null);
                if (!r || !r.ok) return null;
                const b = await r.blob();
                d = await this.readBlobAsDataURL(b);
            }
            let format = 'JPEG';
            if (d.startsWith('data:image/png')) format = 'PNG';
            else if (d.startsWith('data:image/webp')) format = 'WEBP';
            const props = await this.getImageProperties(d).catch(() => ({ ratio: 1.77 }));
            return { data: d, ratio: props.ratio, format };
        } catch (e) {
            console.error('Img Load Err', e);
            return null;
        }
    })
)).filter(Boolean) as { data: string; ratio: number; format: string }[];
```

**Impact:** 100 images sequentially → ~1-2s. Parallel → ~50-100ms.
**Risk:** LOW — pure refactor, identical logic.

---

## Fix 3 — Preview Shortcut: Skip Hydration When Images Already in Store

**File:** `src/components/Editor/ChecklistEditor.tsx`, lines 87-120 (`handleViewPreview`)

If all images in the store already have a `source` URL (from lazy loading when rows were expanded), build the preview revision directly from `activeChecklist` — no re-downloading needed.

```typescript
const handleViewPreview = async () => {
    if (!activeChecklist) return;

    const allImages = activeChecklist.workgroups
        .flatMap(wg => wg.rows)
        .flatMap(r => r.images ?? []);
    const alreadyLoaded = allImages.every(img => !img.id || (img.source && img.source.length > 0));

    if (alreadyLoaded) {
        // Images are already in store as URLs — skip hydration entirely
        const previewRev: Revision = {
            id: 'preview',
            checklistId: activeChecklist.id,
            number: 0,
            title: 'Current Preview',
            notes: '',
            createdAt: new Date(),
            createdBy: activeChecklist.createdBy,
            snapshot: activeChecklist
        };
        setViewingRevision(previewRev);
        return;
    }

    // Some rows not yet expanded — run full hydration
    setLoadingProgress({ open: true, title: 'Preparing Preview', status: 'Fetching images...', percent: 0, cancelled: false });
    isCancelledRef.current = false;
    try {
        const hydratedChecklist = await getChecklistService().getHydratedChecklist(
            activeChecklist.id,
            (status, percent) => {
                if (isCancelledRef.current) return;
                setLoadingProgress(prev => ({ ...prev, status, percent }));
            }
        );
        if (isCancelledRef.current) return;
        const previewRev: Revision = {
            id: 'preview',
            checklistId: hydratedChecklist.id,
            number: 0,
            title: 'Current Preview',
            notes: '',
            createdAt: new Date(),
            createdBy: hydratedChecklist.createdBy,
            snapshot: hydratedChecklist
        };
        setLoadingProgress(prev => ({ ...prev, open: false }));
        setViewingRevision(previewRev);
    } catch (error) {
        console.error('[Editor] Preview Prep Failed', error);
        setLoadingProgress(prev => ({ ...prev, status: 'Error: ' + (error as Error).message, percent: 0 }));
        setTimeout(() => setLoadingProgress(prev => ({ ...prev, open: false })), 3000);
    }
};
```

**Note on preview image display:** `RevisionViewer` renders `<img src={image.source}>` which works with http:// URLs from the store. The lightbox download button is gated on `data:` prefix — it will be hidden for non-hydrated images in preview mode. Acceptable trade-off.

**Impact:** User who expanded rows before clicking Preview → instant (0s). Fallback path unchanged.
**Risk:** LOW

---

## Expected Improvement

| Scenario | Before | After Fix 1+2 (pre-signed URL path) | After Fix 1+2+3 |
|---|---|---|---|
| 100 images, rows expanded | ~25s | ~0.5-1s | ~0s (instant) |
| 100 images, rows not expanded | ~25s | ~0.5-1s | ~0.5-1s |
| 100 images, pre-signed URL unavailable (fallback) | ~25s | ~3-5s | ~3-5s |
| 1,000 images (max checklist) | ~250s | ~5-10s | varies |

---

## Implementation Order

1. **Fix 2** — parallelize `getImageProperties()` (isolated, zero dependencies)
2. **Fix 1 Part A** — test `@microsoft.graph.downloadUrl` in driveItem expand with a small checklist; confirm it appears in the response
3. **Fix 1 Part B** — update `getAllImageMetadata()` source mapping + rewrite hydration loop with concurrency worker pattern
4. **Fix 3** — preview shortcut in `ChecklistEditor` (test both paths)

## Verification

- Export PDF with 20+ images → all images render, export completes in <5s
- Export PDF with 0 images → no regression
- Open checklist, expand rows, click Preview → instant open (no progress bar)
- Open checklist without expanding rows, click Preview → progress bar appears, opens correctly
- Monitor browser Network tab: during hydration, most fetches should go to Azure blob URLs (azurefd.net / sharepointonline CDN), not `graph.microsoft.com`
- For a 1,000-image scenario, monitor browser console for any 429 responses

## Files Changed

| File | Section |
|---|---|
| `src/services/sharePointService.ts` | `getAllImageMetadata()` lines 217-235 |
| `src/services/dataverseChecklistService.ts` | `getHydratedChecklist()` lines 416-440 |
| `src/services/PdfGeneratorService.ts` | Image prep loop lines 290-310 |
| `src/components/Editor/ChecklistEditor.tsx` | `handleViewPreview()` lines 87-120 |
