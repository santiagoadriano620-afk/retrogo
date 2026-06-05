$jsonFile = "D:\GitHub\retrogo\data\misc\quests.json"
$json = Get-Content $jsonFile -Raw | ConvertFrom-Json

function Fix-Mission($qName, $mId, $newKey, $newName) {
  $q = $json | Where-Object { $_.name -eq $qName }
  if (-not $q) { Write-Host "NOT FOUND: $qName"; return }
  $m = $q.missions | Where-Object { $_.id -eq $mId }
  if (-not $m) { Write-Host "NOT FOUND: $qName #$mId"; return }
  if ($newKey -ne $null) { $m.storageKey = $newKey }
  if ($newName -ne $null) { $m.name = $newName }
  Write-Host "  $qName #$mId -> $newKey"
}

# Rookgaard - tile actionIds (30xx) used 70xx instead of 80xx
Fix-Mission "Rookgaard" 10 8012  # Spike Sword (3012)
Fix-Mission "Rookgaard" 11 8051  # Bridge to Level 2 (3051)
Fix-Mission "Rookgaard" 12 8052  # Premium Bridge (3052)

# Thais Adventures - tile actionIds
Fix-Mission "Thais Adventures" 2 8034   # Sewer Gate (3034)
Fix-Mission "Thais Adventures" 9 8117   # Sorcerer (3117)

# Light house - tile actionIds
Fix-Mission "The Lighthouse Secret" 2 8114  # Portal (3114)
Fix-Mission "The Lighthouse Secret" 3 8115  # Exit (3115)
Fix-Mission "The Lighthouse Secret" 5 8033  # Stairway (3033)

# Desert Dungeon - tile actionIds
Fix-Mission "Desert Dungeon" 2 8000  # Tiles (3000)
Fix-Mission "Desert Dungeon" 3 8021  # Library (3021)
Fix-Mission "Desert Dungeon" 4 8070  # Reward Portal (3070)
Fix-Mission "Desert Dungeon" 5 8087  # Druid Portal (3087)
Fix-Mission "Desert Dungeon" 6 8088  # Sorcerer Portal (3088)
Fix-Mission "Desert Dungeon" 7 8089  # Paladin Portal (3089)
Fix-Mission "Desert Dungeon" 8 8090  # Knight Portal (3090)

# Plains of Havoc - tile actionIds
Fix-Mission "Plains of Havoc" 2 8001  # Stalagmites (3001)
# id=3 "Jungle Grass Path" - need to find correct actionId

# Venore - tile actionIds
Fix-Mission "Venore Environs" 5 8003  # Jungle Grass (3003)
Fix-Mission "Venore Environs" 6 8002  # Goblin Mountain (3002)

# Demon Helmet - tile actionIds
Fix-Mission "The Demon Helmet" 2 8022  # Eastern Wall (3022)
Fix-Mission "The Demon Helmet" 3 8023  # Western Wall (3023)
Fix-Mission "The Demon Helmet" 4 8091  # Escape (3091)

# Annihilator
Fix-Mission "The Annihilator" 2 8083  # Escape (3083)

# Edron - tile actionIds
Fix-Mission "Edron Quests" 7 8121  # Demon Scroll (3121)
Fix-Mission "Edron Quests" 8 8025  # Statue (3025)

# Paradox Tower - tile actionIds
Fix-Mission "The Paradox Tower" 5 8004   # Dead Tree (3004)
Fix-Mission "The Paradox Tower" 6 8005   # Entrance (3005)
Fix-Mission "The Paradox Tower" 7 8048   # Crate Puzzle (3048)
Fix-Mission "The Paradox Tower" 8 8049   # Skull Gate (3049)
Fix-Mission "The Paradox Tower" 9 8035   # Stair Opener (3035)
Fix-Mission "The Paradox Tower" 10 8050  # Exit (3050)
# Reward chests use internal storage keys from their JSON files:
Fix-Mission "The Paradox Tower" 11 42   # R1 sets key 42
Fix-Mission "The Paradox Tower" 12 41   # R2 sets key 41
Fix-Mission "The Paradox Tower" 13 43   # R3 sets key 43
Fix-Mission "The Paradox Tower" 14 41   # R4 sets key 41
Fix-Mission "The Paradox Tower" 15 43   # R5 sets key 43
Fix-Mission "The Paradox Tower" 16 42   # R6 sets key 42
Fix-Mission "The Paradox Tower" 17 43   # R7 sets key 43
Fix-Mission "The Paradox Tower" 18 44   # R8 sets key 44
Fix-Mission "The Paradox Tower" 19 41   # R9 sets key 41
Fix-Mission "The Paradox Tower" 20 44   # R10 sets key 44
Fix-Mission "The Paradox Tower" 21 44   # R11 sets key 44
Fix-Mission "The Paradox Tower" 22 42   # R12 sets key 42

# Dark Pyramid - tile actionIds
Fix-Mission "The Dark Pyramid" 1 8019  # Eastern Wall (3019)
Fix-Mission "The Dark Pyramid" 2 8020  # Western Wall (3020)
Fix-Mission "The Dark Pyramid" 3 8103  # Key Passage (3103)
Fix-Mission "The Dark Pyramid" 4 8104  # Lever Puzzle (3104)

# Mystic Flames - all tiles
Fix-Mission "The Mystic Flames" 1 8076  # Flame I (3076)
Fix-Mission "The Mystic Flames" 2 8077  # Flame II (3077)
Fix-Mission "The Mystic Flames" 3 8078  # Flame III (3078)
Fix-Mission "The Mystic Flames" 4 8079  # Flame IV (3079)
Fix-Mission "The Mystic Flames" 5 8080  # Flame V (3080)
Fix-Mission "The Mystic Flames" 6 8081  # Flame VI (3081)
Fix-Mission "The Mystic Flames" 7 8082  # Flame VII (3082)

# Remove duplicate "Beholder Tile" from Thais Adventures
$tha = $json | Where-Object { $_.name -eq "Thais Adventures" }
if ($tha) {
  $tha.missions = @($tha.missions | Where-Object { $_.name -ne "Beholder Tile" })
  Write-Host "Removed 'Beholder Tile' from Thais Adventures"
}

# PoH id=3 "Jungle Grass Path" - actionId unknown, leave as-is for now

$json | ConvertTo-Json -Depth 10 | Set-Content $jsonFile
Write-Host "Done!"
