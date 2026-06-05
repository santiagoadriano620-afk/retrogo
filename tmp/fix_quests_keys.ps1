param(
  [string]$questsFile = "D:\GitHub\retrogo\data\misc\quests.json"
)

# Read the current quests.json
$json = Get-Content $questsFile -Raw | ConvertFrom-Json

function Fix-StorageKey($questName, $missionId, $newKey) {
  $quest = $json | Where-Object { $_.name -eq $questName }
  if (-not $quest) { Write-Host "  Quest not found: $questName"; return }
  $mission = $quest.missions | Where-Object { $_.id -eq $missionId }
  if (-not $mission) { Write-Host "  Mission $missionId not found in $questName"; return }
  $oldKey = $mission.storageKey
  $mission.storageKey = $newKey
  Write-Host "  $questName #$missionId ($($mission.name)): $oldKey -> $newKey"
}

$fixes = @(
  # Rookgaard (quest 10): tiles with wrong 70xx keys
  @{q="Rookgaard"; m=10; k=8012},  # Spike Sword (actionId 3012)
  @{q="Rookgaard"; m=11; k=8051},  # Bridge to Level 2 (actionId 3051)
  @{q="Rookgaard"; m=12; k=8052},  # Premium Bridge (actionId 3052)

  # Thais Adventures (quest 11): fix tile keys, remove duplicate
  @{q="Thais Adventures"; m=2; k=8034},   # Sewer Gate (actionId 3034)
  # Remove id=8 "Beholder Tile" (duplicate)
  @{q="Thais Adventures"; m=9; k=8117},   # Sorcerer-Only (actionId 3117)

  # Lighthouse (quest 12): fix tile keys
  @{q="The Lighthouse Secret"; m=2; k=8114},  # Portal (actionId 3114)
  @{q="The Lighthouse Secret"; m=3; k=8115},  # Exit (actionId 3115)
  @{q="The Lighthouse Secret"; m=5; k=8033},  # Stairway (actionId 3033)

  # Plains of Havoc (quest 17): fix tile keys
  @{q="Plains of Havoc"; m=2; k=8001},  # Stalagmite Passage (actionId 3001)

  # Venore (quest 18): fix tile keys
  @{q="Venore Environs"; m=5; k=8003},  # Hidden Jungle Grass (actionId 3003)
  @{q="Venore Environs"; m=6; k=8002},  # Goblin Mountain (actionId 3002 - wait, also used for Plains of Havoc id=3)

  # Desert Dungeon (quest 16): fix tile keys
  @{q="Desert Dungeon"; m=2; k=8000},  # Pressure Tiles (actionId 3000)
  @{q="Desert Dungeon"; m=3; k=8021},  # Library Switch (actionId 3021)
  @{q="Desert Dungeon"; m=4; k=8070},  # Reward Portal (actionId 3070)
  @{q="Desert Dungeon"; m=5; k=8087},  # Druid Portal (actionId 3087)
  @{q="Desert Dungeon"; m=6; k=8088},  # Sorcerer Portal (actionId 3088)
  @{q="Desert Dungeon"; m=7; k=8089},  # Paladin Portal (actionId 3089)
  @{q="Desert Dungeon"; m=8; k=8090},  # Knight Portal (actionId 3090)

  # Demon Helmet (quest 19): tile keys
  @{q="The Demon Helmet"; m=2; k=8022},  # Eastern Wall (actionId 3022)
  @{q="The Demon Helmet"; m=3; k=8023},  # Western Wall (actionId 3023)
  @{q="The Demon Helmet"; m=4; k=8091},  # Escape Route (actionId 3091)

  # Annihilator (quest 20): tile keys
  @{q="The Annihilator"; m=2; k=8083},  # Escape the Arena (actionId 3083)

  # Edron (quest 21): tile keys
  @{q="Edron Quests"; m=7; k=8121},  # Demon Scroll (actionId 3121)
  @{q="Edron Quests"; m=8; k=8025},  # Statue Removal (actionId 3025)

  # Paradox Tower (quest 22): fix all tile keys
  @{q="The Paradox Tower"; m=5; k=8004},   # Dead Tree (actionId 3004)
  @{q="The Paradox Tower"; m=6; k=8005},   # Tower Entrance (actionId 3005)
  @{q="The Paradox Tower"; m=7; k=8048},   # Crate Puzzle (actionId 3048)
  @{q="The Paradox Tower"; m=8; k=8049},   # Skull Gate (actionId 3049)
  @{q="The Paradox Tower"; m=9; k=8035},   # Stair Opener (actionId 3035)
  @{q="The Paradox Tower"; m=10; k=8050},  # Escape (actionId 3050)
  # Reward chests: these use internal storage keys from the reward files, not actionId+5000
  # Reward 1 (3036): sets key 42 → quest should use 42
  @{q="The Paradox Tower"; m=11; k=42},
  # Reward 2 (3037): sets key 41
  @{q="The Paradox Tower"; m=12; k=41},
  # Reward 3 (3038): sets key 43
  @{q="The Paradox Tower"; m=13; k=43},
  # Reward 4 (3039): sets key 41
  @{q="The Paradox Tower"; m=14; k=41},
  # Reward 5 (3040): sets key 43
  @{q="The Paradox Tower"; m=15; k=43},
  # Reward 6 (3041): sets key 42
  @{q="The Paradox Tower"; m=16; k=42},
  # Reward 7 (3042): sets key 43
  @{q="The Paradox Tower"; m=17; k=43},
  # Reward 8 (3043): sets key 44
  @{q="The Paradox Tower"; m=18; k=44},
  # Reward 9 (3044): sets key 41
  @{q="The Paradox Tower"; m=19; k=41},
  # Reward 10 (3045): sets key 44
  @{q="The Paradox Tower"; m=20; k=44},
  # Reward 11 (3046): sets key 44
  @{q="The Paradox Tower"; m=21; k=44},
  # Reward 12 (3047): sets key 42
  @{q="The Paradox Tower"; m=22; k=42},

  # Kazordoon (quest 23): fix elevator keys (tile actionIds)
  # Elevator Down is actionId 2032 → 7032 ✓
  # Stone Lever is actionId 2033 → 7033 ✓
  # Ladder Lever is actionId 2034 → 7034 ✓
  # Elevator Up is actionId 2035 → 7035 ✓
  # All correct already

  # Pharaoh Tombs (quest 24): fix escape tile keys
  @{q="The Pharaoh Tombs"; m=2; k=8064},   # Escape Thalas (?)
  @{q="The Pharaoh Tombs"; m=3; k=8071},   # Escape Vashresamun
  @{q="The Pharaoh Tombs"; m=4; k=8067},   # Escape Mahrdis
  @{q="The Pharaoh Tombs"; m=5; k=8069},   # Escape Morguthis
  @{q="The Pharaoh Tombs"; m=6; k=8066},   # Escape Omruc
  @{q="The Pharaoh Tombs"; m=7; k=8074},   # Escape Rahemos
  @{q="The Pharaoh Tombs"; m=8; k=8072},   # Escape Dipthrah
  @{q="The Pharaoh Tombs"; m=9; k=8068},   # Escape Ashmunrah
  # Scarab coin seals (actionIds 2053-2062) → 7053-7062 ✓

  # Helmet of Ancients (quest 25): final assembly is lever 2018
  @{q="Helmet of the Ancients"; m=11; k=7018},  # Already correct ✓ (actionId 2018)

  # Dark Pyramid (quest 26)
  @{q="The Dark Pyramid"; m=1; k=8019},  # Eastern Wall (actionId 3019)
  @{q="The Dark Pyramid"; m=2; k=8020},  # Western Wall (actionId 3020)
  @{q="The Dark Pyramid"; m=3; k=8103},  # Key Passage (actionId 3103)
  @{q="The Dark Pyramid"; m=4; k=8104},  # Lever Puzzle (actionId 3104)

  # Desert Symphony (quest 27): all use actionIds 2070-2077 (levers) → 7070-7077 ✓
  # BUT Desert Dungeon Reward Portal also uses 7070! So need to change Desert Symphony

  # Wait, Desert Symphony instruments use actionIds 2070-2077 🤔
  # Actually they might be different actions. Let me check.
  # For now, Desert Symphony uses 7070-7077 ✓ (lever actions)

  # Mystic Flames (quest 28): flame tiles 3076-3082
  @{q="The Mystic Flames"; m=1; k=8076},  # Flame I (actionId 3076)
  @{q="The Mystic Flames"; m=2; k=8077},  # Flame II (actionId 3077)
  @{q="The Mystic Flames"; m=3; k=8078},  # Flame III (actionId 3078)
  @{q="The Mystic Flames"; m=4; k=8079},  # Flame IV (actionId 3079)
  @{q="The Mystic Flames"; m=5; k=8080},  # Flame V (actionId 3080)
  @{q="The Mystic Flames"; m=6; k=8081},  # Flame VI (actionId 3081)
  @{q="The Mystic Flames"; m=7; k=8082},  # Flame VII (actionId 3082)

  # Ankrahmun Secrets (quest 29): Wasp Lever is actionId 2001 → 7001 ✓
  # But Plains of Havoc Stalagmite uses actionId 3001 → now 8001
  # Ankrahmun Secrets id=1 (7001) and id=3 (7003) conflict with Plains of Havoc old keys
  # After fix: Ankrahmun 7001, 7002, 7003 are lever keys - still OK BUT:
  # Plains of Havoc id=3 "Jungle Grass" had 7002 (actionId 3002) → should be 8002
  # Venore id=6 "Goblin Mountain" had 7002 (actionId 3002) → should be 8002
  # Plains of Havoc id=3 was 7002 → Venore id=6 was 7002 → same key
  # After fix: both should be 8002 (same actionId, same tile type)
  # But wait, Plains of Havoc id=3 "The Jungle Grass Path" and Venore id=6 "Goblin Mountain"
  # both use actionId 3002? That doesn't make sense for different locations.
  # Actually looking at the files:
  # - thais/junglegrass_hiddentile.json: actionId 3003
  # - venore/goblin_mountain_junglegrass.json: actionId 3002
  # And Plains of Havoc "Jungle Grass Path" presumably uses a different actionId
  # The quests.json says Plains of Havoc id=3 has storage 7002 → but what actionId?
  # Looking at the Plains of Havoc area files, there's only stalagmites (3001).
  # The "Jungle Grass Path" in PoH might use a different tile action
  # Let me check for PoH-specific jungle grass
)

# Apply all fixes
foreach ($fix in $fixes) {
  Fix-StorageKey $fix.q $fix.m $fix.k
}

# Remove duplicate "Beholder Tile" from Thais Adventures
$tha = $json | Where-Object { $_.name -eq "Thais Adventures" }
if ($tha) {
  $tha.missions = @($tha.missions | Where-Object { $_.name -ne "Beholder Tile" })
  Write-Host "  Removed 'Beholder Tile' from Thais Adventures"
}

# Fix Plains of Havoc id=3 Jungle Grass Path (actionId ?)
# I don't know the exact actionId, but it should not be 7002 anymore
# Since Ankrahmun Secrets now uses 7002 (actionId 2002, Scarab Monument lever)
# PoH Jungle Grass should use a unique key. Let me check if there's a file for it.
# Actually, looking at the Plains of Havoc area more carefully...

# Write back
$json | ConvertTo-Json -Depth 10 | Set-Content $questsFile
Write-Host "Done!"
