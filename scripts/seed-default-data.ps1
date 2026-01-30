# PAP Checklist - Seed Default Workgroups & Rows
# Run this after tables are created in Dataverse
# ============================================

param(
    [Parameter(Mandatory=$true)]
    [string]$EnvironmentUrl  # e.g., https://org35f22684.crm.dynamics.com
)

# -------------------------------------------------------------------------
# IMPORTANT: The list of workgroups defined below ($defaultWorkgroups) is 
# HARDCODED. If the business requirements for the default checklist structure 
# change, you must update the array below. This script skips existing Items 
# by Number, so updates to Names/Orders of existing items require manual data 
# correction or deletion before running this script.
# -------------------------------------------------------------------------

# ============================================
# 1. Authentication (Using Azure CLI)
# ============================================

if ([string]::IsNullOrWhiteSpace($EnvironmentUrl)) {
    Write-Host "Please provide the EnvironmentUrl parameter." -ForegroundColor Red
    exit 1
}

$PublisherPrefix = "pap"
$ApiUrl = "$EnvironmentUrl/api/data/v9.2"

Write-Host "[1/3] Authenticating..." -ForegroundColor Cyan

try {
    $azCheck = Get-Command az -ErrorAction SilentlyContinue
    if (-not $azCheck) { throw "Azure CLI ('az') is not installed." }

    Write-Host "Retrieving access token from Azure CLI..." -ForegroundColor Gray
    $tokenJson = az account get-access-token --resource "$EnvironmentUrl" 2>&1
    
    if ($tokenJson -match "Please run 'az login'") {
        Write-Host "Azure CLI not logged in. Please run: az login --allow-no-subscriptions" -ForegroundColor Red
        exit 1
    }
    
    $tokenObj = $tokenJson | ConvertFrom-Json
    $accessToken = $tokenObj.accessToken

    if ([string]::IsNullOrWhiteSpace($accessToken)) {
        Write-Host "Could not retrieve token." -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✓ Token retrieved" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Error: $_" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
    "OData-MaxVersion" = "4.0"
    "OData-Version" = "4.0"
    "Prefer" = "return=representation" # To get the created ID back immediately
}
# ============================================
# 1.5. Default Data Configuration
# ============================================

$defaultWorkgroups = @(
    @{ Number = "20";        Name = "Preliminaries"; Order = 0 },
    @{ Number = "20.28";     Name = "Home Warranty Insurance"; Order = 1 },
    @{ Number = "30";        Name = "Site Setup"; Order = 2 },
    @{ Number = "40";        Name = "Surveying"; Order = 3 },
    @{ Number = "50";        Name = "Earthworks"; Order = 4 },
    @{ Number = "60";        Name = "Demolition"; Order = 5 },
    @{ Number = "70";        Name = "Asbestos Removal"; Order = 6 },
    @{ Number = "80-150";    Name = "Blockwork / Retaining Walls"; Order = 7 },
    @{ Number = "160";       Name = "Dincel – Concrete Wall System"; Order = 8 },
    @{ Number = "170";       Name = "Brickwork"; Order = 9 },
    @{ Number = "180";       Name = "Rendering"; Order = 10 },
    @{ Number = "190";       Name = "House Raise & Restumping"; Order = 11 },
    @{ Number = "200";       Name = "Concrete Cutting & Patching"; Order = 12 },
    @{ Number = "210-250";   Name = "Concrete Slab"; Order = 13 },
    @{ Number = "260-270";   Name = "Concrete Slab – Waffle Pod"; Order = 14 },
    @{ Number = "280";       Name = "Concrete Slab – Suspended"; Order = 15 },
    @{ Number = "290";       Name = "Concrete – Walls / Columns / Beams"; Order = 16 },
    @{ Number = "300";       Name = "Concrete – Stairs"; Order = 17 },
    @{ Number = "310";       Name = "Concrete – Formwork"; Order = 18 },
    @{ Number = "320";       Name = "Hempcrete Walls"; Order = 19 },
    @{ Number = "330";       Name = "Rammed Earth Walls"; Order = 20 },
    @{ Number = "340";       Name = "Straw Bales"; Order = 21 },
    @{ Number = "350";       Name = "Bitumen / Asphalt"; Order = 22 },
    @{ Number = "360";       Name = "Concrete Tilt Panels"; Order = 23 },
    @{ Number = "370";       Name = "Concrete Floor Finishes"; Order = 24 },
    @{ Number = "380";       Name = "Concrete Stumps"; Order = 25 },
    @{ Number = "390";       Name = "Termite Protection"; Order = 26 },
    @{ Number = "400";       Name = "Hydraulics"; Order = 27 },
    @{ Number = "410";       Name = "Plumbing – Fixtures & Fittings"; Order = 28 },
    @{ Number = "420";       Name = "Plumbing – Sewer Treatment"; Order = 29 },
    @{ Number = "430";       Name = "Fire Hydrant Booster"; Order = 30 },
    @{ Number = "440";       Name = "Fire Sprinklers"; Order = 31 },
    @{ Number = "450";       Name = "Fire Safety Equipment"; Order = 32 },
    @{ Number = "460";       Name = "Ant Capping"; Order = 33 },
    @{ Number = "470";       Name = "Carpentry – Alteration to Existing"; Order = 34 },
    @{ Number = "480";       Name = "Timber Supply"; Order = 35 },
    @{ Number = "490";       Name = "Carpentry – Framing Labour"; Order = 36 },
    @{ Number = "500";       Name = "General Labour"; Order = 37 },
    @{ Number = "510";       Name = "Carpentry – Wall Frames"; Order = 38 },
    @{ Number = "520";       Name = "Carpentry – Roof Frame & Trusses"; Order = 39 },
    @{ Number = "530";       Name = "Carpentry – Timber Posts"; Order = 40 },
    @{ Number = "540";       Name = "Carpentry – Timber Poles"; Order = 41 },
    @{ Number = "550";       Name = "Carpentry – Bearers / Beams / Pitching Plates"; Order = 42 },
    @{ Number = "560";       Name = "Carpentry – Floor Joists"; Order = 43 },
    @{ Number = "570";       Name = "Carpentry – Floor Sheets"; Order = 44 },
    @{ Number = "580";       Name = "Carpentry – Floating Floor"; Order = 45 },
    @{ Number = "590";       Name = "Carpentry – Flooring Parquetry"; Order = 46 },
    @{ Number = "600";       Name = "Carpentry – Flooring T&G"; Order = 47 },
    @{ Number = "610";       Name = "Carpentry – Decking"; Order = 48 },
    @{ Number = "620";       Name = "Carpentry – Bracing & Tie Down"; Order = 49 },
    @{ Number = "630";       Name = "Electrical"; Order = 50 },
    @{ Number = "640";       Name = "Electrical – Security Alarm"; Order = 51 },
    @{ Number = "650";       Name = "Electrical – Solar Panels"; Order = 52 },
    @{ Number = "660";       Name = "Electrical – CCTV"; Order = 53 },
    @{ Number = "670";       Name = "Plumbing & Drainage"; Order = 54 },
    @{ Number = "670.9";     Name = "Plumbing – Hot Water System"; Order = 55 },
    @{ Number = "680";       Name = "Plumbing – Gas"; Order = 56 },
    @{ Number = "690";       Name = "Plumbing – Rainwater Tanks"; Order = 57 },
    @{ Number = "700";       Name = "Steel – Frames"; Order = 58 },
    @{ Number = "710";       Name = "Steel – Brackets"; Order = 59 },
    @{ Number = "720";       Name = "Steel – Posts & Beams"; Order = 60 },
    @{ Number = "730";       Name = "Crane Hire"; Order = 61 },
    @{ Number = "740";       Name = "Scaffolding – Edge Protection"; Order = 62 },
    @{ Number = "750";       Name = "Roofing / Fascia / Gutter"; Order = 63 },
    @{ Number = "760";       Name = "Roofing – Insulated Panels"; Order = 64 },
    @{ Number = "770";       Name = "Roofing – Skylights / Ventilators"; Order = 65 },
    @{ Number = "780";       Name = "Shower Screens & Mirrors"; Order = 66 },
    @{ Number = "790";       Name = "Window & Door – Flashings"; Order = 67 },
    @{ Number = "800";       Name = "Windows & Doors – Aluminium"; Order = 68 },
    @{ Number = "810";       Name = "Windows & Doors – Timber"; Order = 69 },
    @{ Number = "820";       Name = "Windows & Doors – Security / Flyscreens"; Order = 70 },
    @{ Number = "830";       Name = "Window & Door Assemblies"; Order = 71 },
    @{ Number = "840";       Name = "Window Hoods"; Order = 72 },
    @{ Number = "850-1160";  Name = "Cladding"; Order = 73 },
    @{ Number = "1170";      Name = "Lifts"; Order = 74 },
    @{ Number = "1180";      Name = "Scaffolding"; Order = 75 },
    @{ Number = "1190";      Name = "Fibre Cement Compressed"; Order = 76 },
    @{ Number = "1200";      Name = "Doors – Exterior"; Order = 77 },
    @{ Number = "1210";      Name = "Garage Doors"; Order = 78 },
    @{ Number = "1220";      Name = "SIPS Panels"; Order = 79 },
    @{ Number = "1230";      Name = "Insulation"; Order = 80 },
    @{ Number = "1240";      Name = "Insulation – ProClima System"; Order = 81 },
    @{ Number = "1250";      Name = "Plastering – Gyprock"; Order = 82 },
    @{ Number = "1260-1270"; Name = "Party Wall System"; Order = 83 },
    @{ Number = "1280";      Name = "Plastering – White Setting"; Order = 84 },
    @{ Number = "1290";      Name = "Microcement"; Order = 85 },
    @{ Number = "1300";      Name = "Venetian Plaster"; Order = 86 },
    @{ Number = "1310";      Name = "Ceilings – Suspended Concealed"; Order = 87 },
    @{ Number = "1320";      Name = "Ceilings – Suspended Grid"; Order = 88 },
    @{ Number = "1330";      Name = "Carpentry – VJ Timber Panels"; Order = 89 },
    @{ Number = "1340";      Name = "Carpentry – VJ Sheeting"; Order = 90 },
    @{ Number = "1350";      Name = "Cabinetry / Benchtops"; Order = 91 },
    @{ Number = "1360";      Name = "Floor Heating"; Order = 92 },
    @{ Number = "1370";      Name = "Waterproofing"; Order = 93 },
    @{ Number = "1380";      Name = "Tiling"; Order = 94 },
    @{ Number = "1390";      Name = "Silicon Edging"; Order = 95 },
    @{ Number = "1400";      Name = "Natural Stone Sealer"; Order = 96 },
    @{ Number = "1410";      Name = "Stone Cladding"; Order = 97 },
    @{ Number = "1420";      Name = "Colonial Mouldings"; Order = 98 },
    @{ Number = "1430";      Name = "Colonial Doors"; Order = 99 },
    @{ Number = "1440";      Name = "Coffered Ceilings"; Order = 100 },
    @{ Number = "1450";      Name = "Wainscoting"; Order = 101 },
    @{ Number = "1460";      Name = "Carpentry – Fix Out"; Order = 102 },
    @{ Number = "1470";      Name = "Shelving – Melamine"; Order = 103 },
    @{ Number = "1480";      Name = "Shelving – Metal"; Order = 104 },
    @{ Number = "1490";      Name = "Carpentry – Fit Off"; Order = 105 },
    @{ Number = "1500";      Name = "Wardrobe Sliding Doors"; Order = 106 },
    @{ Number = "1510";      Name = "Timber Soffits"; Order = 107 },
    @{ Number = "1520";      Name = "Eaves / Soffits"; Order = 108 },
    @{ Number = "1530";      Name = "Fibre Cement Ceilings"; Order = 109 },
    @{ Number = "1540";      Name = "Gable Ends"; Order = 110 },
    @{ Number = "1550";      Name = "Ceilings – Plywood"; Order = 111 },
    @{ Number = "1560";      Name = "Walls – Plywood"; Order = 112 },
    @{ Number = "1570";      Name = "Air Conditioning"; Order = 113 },
    @{ Number = "1580";      Name = "Vacuum Aid"; Order = 114 },
    @{ Number = "1590";      Name = "Internal Stairs"; Order = 115 },
    @{ Number = "1600";      Name = "External Stairs"; Order = 116 },
    @{ Number = "1610";      Name = "Balustrades & Handrails"; Order = 117 },
    @{ Number = "1620";      Name = "Floor Sanding & Polishing"; Order = 118 },
    @{ Number = "1630";      Name = "Hire Equipment"; Order = 119 },
    @{ Number = "1640";      Name = "Painting"; Order = 120 },
    @{ Number = "1650";      Name = "Fireplace"; Order = 121 },
    @{ Number = "1660";      Name = "Carpet"; Order = 122 },
    @{ Number = "1670";      Name = "Floor Coverings"; Order = 123 },
    @{ Number = "1680";      Name = "Cork Flooring"; Order = 124 },
    @{ Number = "1690";      Name = "Concrete Slab – Pathways / Patio"; Order = 125 },
    @{ Number = "1700";      Name = "Privacy Screens – Vertical"; Order = 126 },
    @{ Number = "1710";      Name = "Privacy Screens – Horizontal"; Order = 127 },
    @{ Number = "1720";      Name = "Awnings"; Order = 128 },
    @{ Number = "1730";      Name = "Site Clean"; Order = 129 },
    @{ Number = "1740";      Name = "House Clean"; Order = 130 },
    @{ Number = "1750";      Name = "Copper Work"; Order = 131 },
    @{ Number = "1760";      Name = "Stone Work"; Order = 132 },
    @{ Number = "1770-1800"; Name = "Landscaping"; Order = 133 },
    @{ Number = "1810";      Name = "Landscaping – Fencing"; Order = 134 },
    @{ Number = "1820";      Name = "Swimming Pool"; Order = 135 },
    @{ Number = "1830";      Name = "Site Supervision"; Order = 136 },
    @{ Number = "1840";      Name = "Travel & Accommodation"; Order = 137 },
    @{ Number = "1850";      Name = "Project Management / Admin"; Order = 138 },
    @{ Number = "1860";      Name = "Kitchen Appliances / White Goods"; Order = 139 },
    @{ Number = "1870";      Name = "Client Contingency"; Order = 140 },
    @{ Number = "1880";      Name = "Blinds & Curtains"; Order = 141 },
    @{ Number = "1890";      Name = "Handover Inspection"; Order = 142 },
    @{ Number = "1900";      Name = "Job Specifications (PC / PS allowances)"; Order = 143 }
)

$defaultRows = @{
    "20" = @(  # Preliminaries
        "Site establishment",
        "Temporary fencing",
        "Site toilet",
        "Skip bins"
    )
    "60" = @(  # Demolition
        "Existing structure removal",
        "Asbestos removal check",
        "Disconnect services"
    )
    "210-250" = @(  # Concrete Slab
        "Excavation",
        "Formwork",
        "Reinforcement",
        "Pour and finish"
    )
    "630" = @(  # Electrical
        "Rough-in",
        "Fit-off",
        "Switchboard upgrade",
        "Meter box relocation"
    )
    "670" = @(  # Plumbing & Drainage
        "Rough-in",
        "Fit-off",
        "Sewer connection",
        "Stormwater"
    )
}

# ============================================
# 2. Helper Functions
# ============================================

function Create-Record {
    param($EntityPluralName, $Body)
    try {
        $jsonBody = $Body | ConvertTo-Json -Depth 10
        $response = Invoke-RestMethod -Method Post -Uri "$ApiUrl/$EntityPluralName" -Headers $headers -Body $jsonBody -SkipHttpErrorCheck -StatusCodeVariable "sc"
        
        if ($sc -eq 201) {
            return $response
        } else {
            Write-Host "    Failed ($sc)" -ForegroundColor Red
            Write-Host ($response | ConvertTo-Json -Depth 3)
            return $null
        }
    } catch {
        Write-Host "    Error: $_" -ForegroundColor Red
        return $null
    }
}

# ============================================
# 3. Seed Data
# ============================================

Write-Host "`n[2/3] Seeding Default Workgroups..." -ForegroundColor Cyan

# Check if we should delete existing ones? For now, we just append or user handles cleanup.
# A robust script might check for existence by Number first.

$workgroupIdMap = @{} # Map Number -> Guid

foreach ($wg in $defaultWorkgroups) {
    Write-Host "  Processing Workgroup: $($wg.Name) ($($wg.Number))..." -NoNewline
    
    # Check existence
    $checkUri = "$ApiUrl/${PublisherPrefix}_defaultworkgroups?`$filter=${PublisherPrefix}_number eq '$($wg.Number)'&`$select=${PublisherPrefix}_defaultworkgroupid"
    $existing = Invoke-RestMethod -Method Get -Uri $checkUri -Headers $headers
    
    $wgId = $null

    if ($existing.value.Count -gt 0) {
        Write-Host " Exists (Skipping)" -ForegroundColor Gray
        $wgId = $existing.value[0]."${PublisherPrefix}_defaultworkgroupid"
    } else {
        # Create
        $body = @{
            "${PublisherPrefix}_name" = $wg.Name
            "${PublisherPrefix}_number" = [string]$wg.Number
            "${PublisherPrefix}_order" = [int]$wg.Order
            "${PublisherPrefix}_isactive" = $true
        }
        $result = Create-Record -EntityPluralName "${PublisherPrefix}_defaultworkgroups" -Body $body
        if ($result) {
            Write-Host " Created" -ForegroundColor Green
            $wgId = $result."${PublisherPrefix}_defaultworkgroupid"
        }
    }
    
    if ($wgId) {
        $workgroupIdMap[$wg.Number] = $wgId
    }
}

Write-Host "`n[3/3] Seeding Default Rows..." -ForegroundColor Cyan

foreach ($wgNumber in $workgroupIdMap.Keys) {
    $parentWgId = $workgroupIdMap[$wgNumber]
    
    $wgName = ($defaultWorkgroups | Where-Object { $_.Number -eq $wgNumber }).Name
    Write-Host "  Adding Rows for: $wgName..." -ForegroundColor White
    
    $order = 0
    
    # 1. Add Common Rows (User Requested)
    $commonRows = @(
        "From Meeting Transcript",
        "By Checklist Filler / Client",
        "By Estimator"
    )

    foreach ($desc in $commonRows) {
        $body = @{
            "${PublisherPrefix}_description_primary" = $desc
            "${PublisherPrefix}_description" = ""
            "${PublisherPrefix}_order" = $order
            "${PublisherPrefix}_isactive" = $true
            "${PublisherPrefix}_defaultworkgroupid@odata.bind" = "/${PublisherPrefix}_defaultworkgroups($parentWgId)"
        }
        
        $jsonBody = $body | ConvertTo-Json -Depth 5
        try {
            Invoke-RestMethod -Method Post -Uri "$ApiUrl/${PublisherPrefix}_defaultrows" -Headers $headers -Body $jsonBody -SkipHttpErrorCheck -StatusCodeVariable "sc" | Out-Null
            if ($sc -ne 204 -and $sc -ne 201) {
                Write-Host "    Failed to add common row '$desc': $sc" -ForegroundColor Red
            }
        } catch {
             Write-Host "    Error adding common row '$desc': $_" -ForegroundColor Red
        }
        $order++
    }

    # 2. Add Specific Rows (if any matching)
    # The map keys might be sensitive to string vs int, so we check carefully
    if ($defaultRows.ContainsKey($wgNumber)) {
        foreach ($desc in $defaultRows[$wgNumber]) {
            $body = @{
                "${PublisherPrefix}_description_primary" = $desc
                "${PublisherPrefix}_description" = ""
                "${PublisherPrefix}_order" = $order
                "${PublisherPrefix}_isactive" = $true
                "${PublisherPrefix}_defaultworkgroupid@odata.bind" = "/${PublisherPrefix}_defaultworkgroups($parentWgId)"
            }
            
            $jsonBody = $body | ConvertTo-Json -Depth 5
            try {
                Invoke-RestMethod -Method Post -Uri "$ApiUrl/${PublisherPrefix}_defaultrows" -Headers $headers -Body $jsonBody -SkipHttpErrorCheck -StatusCodeVariable "sc" | Out-Null
                if ($sc -ne 204 -and $sc -ne 201) {
                    Write-Host "    Failed to add row '$desc': $sc" -ForegroundColor Red
                }
            } catch {
                 Write-Host "    Error adding row '$desc': $_" -ForegroundColor Red
            }
            $order++
        }
    }
    
    Write-Host "    ✓ Added rows (Common + Specific)" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Seeding Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
