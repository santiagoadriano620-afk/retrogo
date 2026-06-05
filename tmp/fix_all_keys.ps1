$jsonFile = "D:\GitHub\retrogo\data\misc\quests.json"
$json = Get-Content $jsonFile -Raw | ConvertFrom-Json

function Fix-Mission($qName, $mId, $newKey) {
  $q = $json | Where-Object { $_.name -eq $qName }
  if (-not $q) { Write-Host "NOT FOUND: $qName"; return }
  $m = $q.missions | Where-Object { $_.id -eq $mId }
  if (-not $m) { Write-Host "NOT FOUND: $qName #$mId"; return }
  $oldKey = $m.storageKey
  $m.storageKey = $newKey
  Write-Host "$qName #$mId ($($m.name)): $oldKey → $newKey"
}

# === PHARAOH TOMBS (quest 24) ===
$fixes = @(
  @{q="The Pharaoh Tombs"; m=1; k=8063},   # Thalas lever puzzle (3063)
  @{q="The Pharaoh Tombs"; m=2; k=8064},   # Thalas exit (3064)
  @{q="The Pharaoh Tombs"; m=3; k=8071},   # Vashresamun exit (3071)
  @{q="The Pharaoh Tombs"; m=4; k=8067},   # Mahrdis exit (3067)
  @{q="The Pharaoh Tombs"; m=5; k=8069},   # Morguthis exit (3069)
  @{q="The Pharaoh Tombs"; m=6; k=8066},   # Omruc exit (3066)
  @{q="The Pharaoh Tombs"; m=7; k=8074},   # Rahemos exit (3074)
  @{q="The Pharaoh Tombs"; m=8; k=8072},   # Dipthrah exit (3072)
  @{q="The Pharaoh Tombs"; m=9; k=8068},   # Ashmunrah exit (3068)
  @{q="The Pharaoh Tombs"; m=10; k=8053},  # Thalas scarab coin (3053)
  @{q="The Pharaoh Tombs"; m=11; k=8054},  # Vashresamun scarab coin (3054)
  @{q="The Pharaoh Tombs"; m=12; k=8055},  # Mahrdis scarab coin (3055)
  @{q="The Pharaoh Tombs"; m=13; k=8056},  # Morguthis scarab coin (3056)
  @{q="The Pharaoh Tombs"; m=14; k=8057},  # Temple scarab coin (3057)
  @{q="The Pharaoh Tombs"; m=15; k=8058},  # Rahemos scarab coin (3058)
  @{q="The Pharaoh Tombs"; m=16; k=8059},  # Omruc scarab coin (3059)
  @{q="The Pharaoh Tombs"; m=17; k=8060},  # Dipthrah scarab coin (3060)
  @{q="The Pharaoh Tombs"; m=18; k=8061},  # Altar (3061)
  @{q="The Pharaoh Tombs"; m=19; k=8062},  # Altar 2 (3062)
  @{q="The Pharaoh Tombs"; m=20; k=8065},  # Deathslicer (3065)

  # === HELMET OF THE ANCIENTS (quest 25) ===
  @{q="Helmet of the Ancients"; m=11; k=8018},  # Final assembly (3018)

  # === ANKRAHMUN SECRETS (quest 29) ===
  @{q="Ankrahmun Secrets"; m=9; k=8014},   # Morgathla seal (3014)
  @{q="Ankrahmun Secrets"; m=10; k=8015},  # Cobra venom (3015)
  @{q="Ankrahmun Secrets"; m=11; k=8016},  # Pacman east (3016)
  @{q="Ankrahmun Secrets"; m=12; k=8017},  # Pacman west (3017)

  # === DOOR HALLWAY (quest 30) ===
  @{q="The Door Hallway"; m=1; k=8122},  # Wrong door (3122)
  @{q="The Door Hallway"; m=2; k=8123},  # Correct door (3123)
  @{q="The Door Hallway"; m=3; k=8075},  # Hallway teleport (3075)

  # === BANSHEE'S CURSE (quest 31) ===
  # Tiles (30xx)
  @{q="The Banshee's Curse"; m=8; k=8006},   # Stepback illusion south (3006)
  @{q="The Banshee's Curse"; m=9; k=8007},   # Stepback illusion north (3007)
  @{q="The Banshee's Curse"; m=10; k=8008},  # Hole removal south (3008)
  @{q="The Banshee's Curse"; m=11; k=8009},  # Hole removal north (3009)
  @{q="The Banshee's Curse"; m=12; k=8010},  # Entrance restore I (3010)
  @{q="The Banshee's Curse"; m=13; k=8011},  # Entrance restore II (3011)
  @{q="The Banshee's Curse"; m=14; k=8026},  # Summon warlock (3026)
  @{q="The Banshee's Curse"; m=15; k=8027},  # Tile puzzle start (3027)
  @{q="The Banshee's Curse"; m=16; k=8028},  # Tile puzzle correct (3028)
  @{q="The Banshee's Curse"; m=17; k=8029},  # Tile puzzle incorrect (3029)
  @{q="The Banshee's Curse"; m=18; k=8030},  # Blood tile (3030)
  @{q="The Banshee's Curse"; m=19; k=8098},  # Ghost seal (3098)
  @{q="The Banshee's Curse"; m=20; k=8099},  # Blood seal (3099)
  @{q="The Banshee's Curse"; m=21; k=8100},  # Warlock seal (3100)
  @{q="The Banshee's Curse"; m=22; k=8101},  # Tiles seal (3101)
  @{q="The Banshee's Curse"; m=23; k=8102},  # Pearls seal (3102)
  @{q="The Banshee's Curse"; m=24; k=8095},  # Pearls puzzle I (3095)
  @{q="The Banshee's Curse"; m=25; k=8096},  # Pearls puzzle II (3096)
  @{q="The Banshee's Curse"; m=26; k=8097},  # Banshee lever puzzle (3097)
  @{q="The Banshee's Curse"; m=27; k=8094},  # Escape (3094)
  @{q="The Banshee's Curse"; m=28; k=8024},  # Restore Magic Walls (3024)
  # Sub-levers (2027-2031) keep their 7027-7031 keys
  # But tiles with same key need different keys now:
  # id=15 tile start was 7027, sub-lever #1 is 7027 - need unique
  # Sub-levers stay at 7027-7031, tiles move to 8027-8030

  # === PORT HOPE (quest 32) ===
  @{q="Port Hope"; m=3; k=8084},  # Kongra teleport (3084)
  @{q="Port Hope"; m=4; k=8085},  # Canopic jar (3085)
  @{q="Port Hope"; m=6; k=8092},  # Orichalcum pearl I (3092)
  @{q="Port Hope"; m=7; k=8093},  # Orichalcum pearl II (3093)

  # === ISLE OF KINGS (quest 33) ===
  @{q="Isle of Kings"; m=1; k=8031},  # Trespass 1 (3031)
  @{q="Isle of Kings"; m=2; k=8032},  # Trespass 2 (3032)

  # === DOG TRACK (quest 44) ===
  @{q="The Dog Track"; m=2; k=8119},  # North lap (3119)
  @{q="The Dog Track"; m=3; k=8120}   # South lap (3120)
)

foreach ($fix in $fixes) {
  Fix-Mission $fix.q $fix.m $fix.k
}

$json | ConvertTo-Json -Depth 10 | Set-Content $jsonFile
Write-Host "Done!"
