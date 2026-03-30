# Implementation Plan - Phase 2: AI-Assisted Productivity

**Status:** 🟡 PLANNED — Not yet started. AI backend architecture decision required before implementation (see User Review Required section below).

## Goal Description
Implement an AI-assisted checklist auto-filling feature for the PAP Checklist SPFx project. Users will be able to upload client call transcripts, which will be processed by an AI model to suggest values for checklist fields. The UI will display these suggestions alongside confidence indicators, allowing estimators to manually review, approve, or reject them. This will reduce manual effort, speed up data entry, and improve consistency.

## Overview of Key Capabilities
1. **Upload client call transcripts**: File picker or drag-and-drop mechanism within the checklist editor.
2. **AI suggests checklist field values**: Send transcript to an AI backend (e.g., Azure OpenAI), process the text against the checklist schema, and return structured suggestions.
3. **Confidence indicators**: The AI backend will provide a confidence score (e.g., Low, Medium, High) for each suggested value. This will be visually represented in the UI next to the relevant field.
4. **Manual review and approval**: Estimators can review all suggestions in a dedicated panel or inline within the checklist. They can accept suggestions (applying them to the checklist) or reject them.

## User Review Required
> [!IMPORTANT]
> **AI Backend Integration**: We need to define how the SPFx web part will communicate with the AI model. 
> - Will we use an Azure API Management endpoint? 
> - Directly call Azure OpenAI from the client (requires securely managing keys, not recommended)?
> - Call a secure backend middle-tier API?
> **Please clarify the intended architecture for the AI calls.**

## Proposed Changes

### Core Models & State
#### [MODIFY] [models/index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)
- Add interfaces for `AiSuggestion` (e.g., `rowId`, `suggestedAnswer`, `suggestedNotes`, `confidenceScore`, `rationale`).
- Update `ChecklistRow` interface or create a separate state to hold pending AI suggestions for each row so they can be reviewed.

#### [MODIFY] [stores/checklistStore.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/stores/checklistStore.ts)
- Add state for managing transcript upload (loading status, error handling).
- Add state for storing incoming AI suggestions.
- Add actions: `processTranscript()`, `applyAiSuggestion()`, `rejectAiSuggestion()`, `applyAllAiSuggestions()`.

### Services
#### [NEW] [services/aiService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/aiService.ts)
- Create a new service dedicated to making API calls to the AI backend.
- Define methods like `analyzeTranscript(file: File, checklistTemplate: any): Promise<AiSuggestion[]>`.

### UI Components
#### [NEW] [components/Editor/AiAssistantPanel.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/AiAssistantPanel.tsx)
- A new panel (perhaps integrated into the Sidebar or as a new tab) dedicated to the AI features.
- Provide a file upload input for transcripts (.txt, .docx, .vtt, etc.).
- Display a summary of extracted suggestions and a "Apply All" button.

#### [MODIFY] [components/Editor/ChecklistRowItem.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistRowItem.tsx)
- Add visual indicators (badges or highlights) when a row has a pending AI suggestion.
- Display the suggested value, confidence score (e.g., color-coded Low/Med/High), and rationale.
- Add "Accept" and "Reject" buttons inline for the suggestion.

## Verification Plan

### Manual Verification
1.  **UI Layout**: Verify the "AI Assistant" section is accessible within the checklist editor.
2.  **Upload Flow**: Upload a sample transcript file and ensure loading states correctly reflect the processing time.
3.  **Suggestion Rendering**: Verify that mocked AI suggestions appear accurately in the UI, correctly mapping to the respective checklist rows.
4.  **Confidence Display**: Check that the confidence indicators are visually distinct (e.g., Green for High, Yellow for Medium).
5.  **Review Workflow**: 
    - Test accepting a single suggestion (updates the real checklist state).
    - Test rejecting a suggestion (clears the suggestion without affecting the real state).
    - Test "Accept All" functionality.
