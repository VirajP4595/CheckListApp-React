# PAP Checklist Enhancements

## Phase 1: Insert Row + Job Metadata
- [x] Modify `WorkgroupSection.tsx` — add `+` insert button between rows
- [x] Add `.insert-row-divider` styles to `WorkgroupSection.module.scss`
- [x] Extend `Checklist.jobDetails` in `models/index.ts` with new fields (TEMP names)
- [x] Update `DataverseChecklist` interface in `dataverseChecklistService.ts`
- [x] Update OData `$expand` query with new job fields
- [x] Update `mapChecklist` to map new fields
- [x] Integrate `JobMetadataHeader` into `ChecklistEditor.tsx`

## Phase 2: Status Dropdown + Flags Integration
- [x] Plan status dropdown redesign, Notify Admin flag, and BTC flag with PDF export
- [x] Implement Part 1: Status Dropdown Changes (Rename 2, Add 3)
- [x] Implement Part 2: Notify Admin Flag (Model, Dataverse Service, UI Toggle, Filter)
- [x] Implement Part 3: BTC Flag & Export (Model, Dataverse Service, UI Toggle, Filter, BtcExportService)

## Verification
- [x] TypeScript compile check
- [ ] Visual verification (user testing)
- [ ] Client confirmation of Dataverse column names (Builder, Engineering, Site Address)
