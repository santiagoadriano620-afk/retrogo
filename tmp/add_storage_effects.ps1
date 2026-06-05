param(
  [string]$questsRoot = "D:\GitHub\retrogo\data\quests"
)

function Add-StorageEffect($obj, $key, $value) {
  $storageEffect = @{type="storage"; key=$key; value=$value}
  if ($obj.effects -and $obj.effects.Count -gt 0) {
    # Check if storage already exists
    $hasStorage = $false
    foreach ($e in $obj.effects) { if ($e.type -eq "storage" -and $e.key -eq $key) { $hasStorage = $true; break } }
    if (-not $hasStorage) { $obj.effects += $storageEffect; return $true }
  } elseif ($obj.effects) {
    # Empty effects array
    if (-not ($obj.effects | Where-Object { $_.type -eq "storage" })) { $obj.effects += $storageEffect; return $true }
  }
  return $false
}

function Add-StorageToFile($filePath) {
  try {
    $content = Get-Content $filePath -Raw
    $json = $content | ConvertFrom-Json
    
    $didModify = $false
    
      # Handle array of actions
    if ($json -is [System.Array]) {
      foreach ($item in $json) {
        if ($item.actionId -and $item.effects -ne $null) {
          $key = [int]$item.actionId + 5000
          if (Add-StorageEffect $item $key 1) { $didModify = $true }
        }
        # Also handle branches
        if ($item.branches) {
          foreach ($branch in $item.branches) {
            if ($branch.effects -and $item.actionId) {
              $key = [int]$item.actionId + 5000
              if (Add-StorageEffect $branch $key 1) { $didModify = $true }
            }
          }
        }
      }
    } else {
      # Single action object
      if ($json.actionId) {
        $key = [int]$json.actionId + 5000
        
        # Handle effects array
        if ($json.effects -ne $null) {
          if (Add-StorageEffect $json $key 1) { $didModify = $true }
        }
        
        # Handle effectsOnStepIn/effectsOnStepOut
        if ($json.effectsOnStepIn) {
          $hasStorageIn = $false
          foreach ($e in $json.effectsOnStepIn) { if ($e.type -eq "storage") { $hasStorageIn = $true; break } }
          if (-not $hasStorageIn) { $json.effectsOnStepIn += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
        if ($json.effectsOnStepOut) {
          $hasStorageOut = $false
          foreach ($e in $json.effectsOnStepOut) { if ($e.type -eq "storage") { $hasStorageOut = $true; break } }
          if (-not $hasStorageOut) { $json.effectsOnStepOut += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
        
        # Handle effectsStepIn/effectsStepOut
        if ($json.effectsStepIn) {
          $hasStorageIn = $false
          foreach ($e in $json.effectsStepIn) { if ($e.type -eq "storage") { $hasStorageIn = $true; break } }
          if (-not $hasStorageIn) { $json.effectsStepIn += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
        if ($json.effectsStepOut) {
          $hasStorageOut = $false
          foreach ($e in $json.effectsStepOut) { if ($e.type -eq "storage") { $hasStorageOut = $true; break } }
          if (-not $hasStorageOut) { $json.effectsStepOut += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
        
        # Handle branches
        if ($json.branches) {
          foreach ($branch in $json.branches) {
            if ($branch.effects) {
              $hasStorage = $false
              foreach ($e in $branch.effects) { if ($e.type -eq "storage") { $hasStorage = $true; break } }
              if (-not $hasStorage) { $branch.effects += @{type="storage"; key=$key; value=1}; $didModify = $true }
            }
          }
        }
        
        # Handle effectsAlt (if effects doesn't exist, add to effectsAlt)
        if ($json.effects -eq $null -and $json.effectsAlt -ne $null) {
          $hasStorage = $false
          foreach ($e in $json.effectsAlt) { if ($e.type -eq "storage") { $hasStorage = $true; break } }
          if (-not $hasStorage) { $json.effectsAlt += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
        
        # Handle effectsAddItem
        if ($json.effectsAddItem) {
          $hasStorage = $false
          foreach ($e in $json.effectsAddItem) { if ($e.type -eq "storage") { $hasStorage = $true; break } }
          if (-not $hasStorage) { $json.effectsAddItem += @{type="storage"; key=$key; value=1}; $didModify = $true }
        }
      }
    }
    
    if ($didModify) {
      Write-Host "  $filePath"
      $json | ConvertTo-Json -Depth 10 | Set-Content $filePath
    }
  } catch {
    Write-Host "  ERROR: $filePath : $_"
  }
}

# Get all quest action JSON files (skip misc, chests.json, home.json files)
Write-Host "Scanning quest action JSON files..."
Get-ChildItem -Path $questsRoot -Filter *.json -Recurse | Where-Object {
  $_.FullName -notmatch '\\misc\\' -and
  $_.Name -ne 'chests.json' -and
  $_.Name -ne 'quests.json'
} | ForEach-Object {
  Add-StorageToFile $_.FullName
}
Write-Host "Done!"
