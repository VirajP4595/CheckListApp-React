# Power Automate Flow: Auto-Create Checklist on Job Creation

This document outlines the steps to create a Power Automate flow that automatically generates a checklist when a new Job is created in Dataverse.

## Prerequisities
- Power Automate license.
- Access to the Dataverse environment (`org35f22684.crm.dynamics.com`).
- `pap_jobs` and `pap_checklists` tables must exist.

## Flow Logic

1.  **Trigger**: `When a row is added, modified or deleted`
    - Change Type: `Added`
    - Table Name: `Jobs` (`pap_jobs`)
    - Scope: `Organization`

2.  **Action**: `Add a new row` (Dataverse)
    - Table Name: `Checklists` (`pap_checklists`)
    - **Mapping**:
        - `Name`: `@{triggerOutputs()?['body/pap_name']} Checklist` (or custom naming pattern)
        - `Status`: `1` (Draft)
        - `Current Revision Number`: `0`
        - `Job (Bind)`: `pap_jobs(@{triggerOutputs()?['body/pap_jobid']})` (This links the checklist to the newly created job)

3.  **Action**: `List rows` (Dataverse) - *Get Default Workgroups*
    - Table Name: `Default Workgroups` (`pap_defaultworkgroups`)
    - Filter Rows: `pap_isactive eq true`
    - Sort By: `pap_order asc`

4.  **Control**: `Apply to each`
    - Input: `@{outputs('List_rows')?['body/value']}`
    - **Inside Loop**:
        - **Action**: `Add a new row` (Dataverse) - *Create Workgroup*
            - Table Name: `Workgroups` (`pap_workgroups`)
            - `Name`: `@{items('Apply_to_each')?['pap_name']}`
            - `Number`: `@{items('Apply_to_each')?['pap_number']}`
            - `Order`: `@{items('Apply_to_each')?['pap_order']}`
            - `Checklist (Bind)`: `pap_checklists(@{outputs('Add_a_new_row')?['body/pap_checklistid']})`
        
        - **Action**: `List rows` (Dataverse) - *Get Default Rows for this Workgroup*
             - Table Name: `Default Rows` (`pap_defaultrows`)
             - Filter Rows: `_pap_defaultworkgroupid_value eq @{items('Apply_to_each')?['pap_defaultworkgroupid']}`
             - Sort By: `pap_order asc`
        
        - **Control**: `Apply to each` (Nested) - *Create Checklist Rows*
             - Input: `@{outputs('List_rows_2')?['body/value']}`
             - **Inside Loop**:
                 - **Action**: `Add a new row`
                     - Table Name: `Checklist Rows` (`pap_checklistrows`)
                     - `Description`: `@{items('Apply_to_each_2')?['title']}`
                     - `Order`: `@{items('Apply_to_each_2')?['pap_order']}`
                     - `Workgroup (Bind)`: `pap_workgroups(@{outputs('Add_a_new_row_2')?['body/pap_workgroupid']})`

## Validation
- Create a new Job in the Dataverse Model-Driven App.
- Wait for the flow to run (approx 1-2 mins).
- Verify a new Checklist appears in the PAP Checklist App dashboard.
