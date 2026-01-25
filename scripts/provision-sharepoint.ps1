# PAP Checklist - SharePoint Provisioning Script
# Prerequisites: PnP.PowerShell module installed
# Install: Install-Module -Name PnP.PowerShell -Scope CurrentUser -Force

param(
    [Parameter(Mandatory=$true)]
    [string]$SiteUrl  # e.g., https://contoso.sharepoint.com/sites/pap-checklist
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PAP Checklist - SharePoint Provisioning" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# Connect to SharePoint
# ============================================

Write-Host "Connecting to SharePoint..." -ForegroundColor Yellow
try {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId "6dfb21b8-6846-4061-88ec-115681263ee3"
    Write-Host "  ✓ Connected to $SiteUrl" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Failed to connect: $_" -ForegroundColor Red
    exit 1
}

# ============================================
# Create Document Library
# ============================================

$libraryName = "PAP Attachments"
$libraryUrl = "PAPAttachments"

Write-Host "`nCreating document library: $libraryName" -ForegroundColor Yellow

$library = Get-PnPList -Identity $libraryUrl -ErrorAction SilentlyContinue
if (-not $library) {
    New-PnPList -Title $libraryName -Url $libraryUrl -Template DocumentLibrary
    Write-Host "  ✓ Library created" -ForegroundColor Green
} else {
    Write-Host "  ✓ Library already exists" -ForegroundColor Green
}

# ============================================
# Add Metadata Columns
# ============================================

Write-Host "`nAdding metadata columns..." -ForegroundColor Yellow

# ChecklistId column
$field = Get-PnPField -List $libraryUrl -Identity "ChecklistId" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "Checklist ID" -InternalName "ChecklistId" -Type Text -AddToDefaultView
    Write-Host "  ✓ ChecklistId column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ ChecklistId column exists" -ForegroundColor Green
}

# RowId column
$field = Get-PnPField -List $libraryUrl -Identity "RowId" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "Row ID" -InternalName "RowId" -Type Text -AddToDefaultView
    Write-Host "  ✓ RowId column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ RowId column exists" -ForegroundColor Green
}

# FileType column (Choice)
$field = Get-PnPField -List $libraryUrl -Identity "PAPFileType" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "File Type" -InternalName "PAPFileType" -Type Choice -Choices "Attachment","Image" -AddToDefaultView
    Write-Host "  ✓ FileType column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ FileType column exists" -ForegroundColor Green
}

# Caption column
$field = Get-PnPField -List $libraryUrl -Identity "Caption" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "Caption" -InternalName "Caption" -Type Text
    Write-Host "  ✓ Caption column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ Caption column exists" -ForegroundColor Green
}

# Order column
$field = Get-PnPField -List $libraryUrl -Identity "DisplayOrder" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "Display Order" -InternalName "DisplayOrder" -Type Number
    Write-Host "  ✓ DisplayOrder column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ DisplayOrder column exists" -ForegroundColor Green
}

# UploadedBy column (Person)
$field = Get-PnPField -List $libraryUrl -Identity "UploadedBy" -ErrorAction SilentlyContinue
if (-not $field) {
    Add-PnPField -List $libraryUrl -DisplayName "Uploaded By" -InternalName "UploadedBy" -Type User
    Write-Host "  ✓ UploadedBy column added" -ForegroundColor Green
} else {
    Write-Host "  ✓ UploadedBy column exists" -ForegroundColor Green
}

# ============================================
# Create Folder Structure Template
# ============================================

Write-Host "`nCreating template folder structure..." -ForegroundColor Yellow

# Create a template folder (will be copied for each checklist)
$templateFolder = "_template"
try {
    $folder = Get-PnPFolder -Url "$libraryUrl/$templateFolder" -ErrorAction Stop
    Write-Host "  ✓ Template folder exists" -ForegroundColor Green
} catch {
    Add-PnPFolder -Name $templateFolder -Folder $libraryUrl | Out-Null
    Add-PnPFolder -Name "files" -Folder "$libraryUrl/$templateFolder" | Out-Null
    Add-PnPFolder -Name "images" -Folder "$libraryUrl/$templateFolder" | Out-Null
    Write-Host "  ✓ Template folder structure created" -ForegroundColor Green
}

# ============================================
# Set Library Settings
# ============================================

Write-Host "`nConfiguring library settings..." -ForegroundColor Yellow

# Enable versioning
Set-PnPList -Identity $libraryUrl -EnableVersioning $true -MajorVersions 50
Write-Host "  ✓ Versioning enabled (50 major versions)" -ForegroundColor Green

# ============================================
# Summary
# ============================================

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SharePoint Provisioning Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Library URL: $SiteUrl/$libraryUrl" -ForegroundColor White
Write-Host ""
Write-Host "Columns Created:" -ForegroundColor White
Write-Host "  - ChecklistId (Text)" 
Write-Host "  - RowId (Text)"
Write-Host "  - PAPFileType (Choice: Attachment, Image)"
Write-Host "  - Caption (Text)"
Write-Host "  - DisplayOrder (Number)"
Write-Host "  - UploadedBy (Person)"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Configure permissions on the library"
Write-Host "  2. Update SPFx solution with library URL"
Write-Host "  3. Test file upload from the app"
Write-Host ""

Disconnect-PnPOnline
