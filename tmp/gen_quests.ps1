$questsFile = "D:\GitHub\retrogo\data\misc\quests.json"
$quests = @()

# === 1. The Rookie ===
$quests += [PSCustomObject]@{ id = 1; name = "The Rookie"; missions = @(
  [PSCustomObject]@{ id=1; name="Talk to the Oracle"; description="Go to the temple and talk to the Oracle to choose your vocation."; storageKey=1001; storageValue=1 }
  [PSCustomObject]@{ id=2; name="First Equipment"; description="Find the chest in the sewers to get your first equipment."; storageKey=1001; storageValue=2 }
)}

# === 2. Rat Plague ===
$quests += [PSCustomObject]@{ id = 2; name = "Rat Plague"; missions = @(
  [PSCustomObject]@{ id=1; name="Exterminate Rats"; description="Kill 10 rats in the basement."; storageKey=1002; storageValue=1 }
)}

# === 3. The Magician ===
$quests += [PSCustomObject]@{ id = 3; name = "The Magician"; missions = @(
  [PSCustomObject]@{ id=1; name="Cast Light"; description="Cast the Light spell to prove your magical ability."; storageKey=2001; storageValue=1 }
)}

# === 10. Rookgaard ===
$quests += [PSCustomObject]@{ id = 10; name = "Rookgaard"; missions = @(
  [PSCustomObject]@{ id=1; name="The Katana Door"; description="Pull the lever to open the katana door."; storageKey=7051; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Bear's Chamber"; description="Pull the lever to unlock the bear room."; storageKey=7052; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Rat Bridge"; description="Activate the bridge mechanism to cross the rat pit."; storageKey=7053; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Rat Bridge Part II"; description="Pull the second lever to complete the rat bridge."; storageKey=7054; storageValue=1 }
  [PSCustomObject]@{ id=5; name="The Hidden Library"; description="Pull the lever to reveal the secret library entrance."; storageKey=7055; storageValue=1 }
  [PSCustomObject]@{ id=6; name="The Bug Infestation"; description="Pull the lever to clear the bug path."; storageKey=7056; storageValue=1 }
  [PSCustomObject]@{ id=7; name="The Wolf's Lair"; description="Pull the lever to open the wolf den passage."; storageKey=7057; storageValue=1 }
  [PSCustomObject]@{ id=8; name="The Troll Cave"; description="Pull the lever to gain access deeper into troll territory."; storageKey=7058; storageValue=1 }
  [PSCustomObject]@{ id=9; name="The Spider's Web"; description="Pull the lever to bypass the spider nest."; storageKey=7059; storageValue=1 }
  [PSCustomObject]@{ id=10; name="The Spike Sword"; description="Step on the pressure plate to claim the Spike Sword."; storageKey=7012; storageValue=1 }
  [PSCustomObject]@{ id=11; name="Bridge to Level 2"; description="Activate the bridge to reach the second level."; storageKey=7051; storageValue=1 }
  [PSCustomObject]@{ id=12; name="The Premium Bridge"; description="Cross the premium bridge to access restricted areas."; storageKey=7052; storageValue=1 }
)}

# === 11. Thais Adventures ===
$quests += [PSCustomObject]@{ id = 11; name = "Thais Adventures"; missions = @(
  [PSCustomObject]@{ id=1; name="Mintwallin Bridge"; description="Pull the lever to extend the bridge in Mintwallin."; storageKey=7037; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Mintwallin Sewer Gate"; description="Step on the tile to open the Mintwallin sewer gate."; storageKey=7034; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Beholder Bridge South"; description="Pull the southern lever to connect the beholder bridge."; storageKey=7060; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Beholder Bridge North"; description="Pull the northern lever to complete the beholder bridge."; storageKey=7061; storageValue=1 }
  [PSCustomObject]@{ id=5; name="McRonald's Pig #1"; description="Pull the first lever to help McRonald with his pigs."; storageKey=7062; storageValue=1 }
  [PSCustomObject]@{ id=6; name="McRonald's Pig #2"; description="Pull the second lever to finish the pig puzzle."; storageKey=7063; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Cyclops Wall"; description="Pull the lever to open the cyclops wall."; storageKey=7066; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Beholder Tile"; description="Walk onto the beholder-only tile."; storageKey=7117; storageValue=1 }
  [PSCustomObject]@{ id=9; name="Sorcerer-Only Passage"; description="Pass through the sorcerer-only gate in Thais."; storageKey=7117; storageValue=1 }
)}

# === 12. The Lighthouse Secret ===
$quests += [PSCustomObject]@{ id = 12; name = "The Lighthouse Secret"; missions = @(
  [PSCustomObject]@{ id=1; name="The Lighthouse Entrance"; description="Pull the lever to enter the lighthouse."; storageKey=7064; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Lighthouse Portal"; description="Activate the portal deep within the lighthouse."; storageKey=7114; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Escape the Lighthouse"; description="Find the exit portal to leave the lighthouse."; storageKey=7115; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Lighthouse Teleport"; description="Pull the lever to activate the lighthouse teleport."; storageKey=7065; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Lighthouse Stairway"; description="Step on the hidden tile to reveal the lighthouse stairs."; storageKey=7033; storageValue=1 }
)}

# === 13. The Draw Well ===
$quests += [PSCustomObject]@{ id = 13; name = "The Draw Well"; missions = @(
  [PSCustomObject]@{ id=1; name="Down the Well"; description="Pull the lever to descend into the draw well."; storageKey=7078; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Fibula Well Entrance"; description="Pull the lever to enter the Fibula draw well."; storageKey=7079; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Skeleton Well"; description="Step into the teleport to reach the skeleton well."; storageKey=7080; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Pick Hole"; description="Use a pick on the marked spot to dig a hole."; storageKey=9003; storageValue=1 }
)}

# === 15. The Bright Sword ===
$quests += [PSCustomObject]@{ id = 15; name = "The Bright Sword"; missions = @(
  [PSCustomObject]@{ id=1; name="The Barrel Lever"; description="Pull the barrel lever to advance the Bright Sword quest."; storageKey=7044; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Oven Lever"; description="Pull the oven lever to continue forging the Bright Sword."; storageKey=7045; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Power Ring Lever"; description="Pull the power ring lever to complete the Bright Sword."; storageKey=7046; storageValue=1 }
)}

# === 16. Desert Dungeon ===
$quests += [PSCustomObject]@{ id = 16; name = "Desert Dungeon"; missions = @(
  [PSCustomObject]@{ id=1; name="The Dungeon Lever"; description="Pull the lever to enter the desert dungeon."; storageKey=7010; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Pressure Tiles"; description="Navigate the pressure tile puzzle in the desert dungeon."; storageKey=7000; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Library Switch"; description="Flip the switch in the desert dungeon library."; storageKey=7021; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Reward Portal"; description="Enter the portal to claim the desert dungeon reward."; storageKey=7070; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Druid Portal"; description="Pass through the druid gate."; storageKey=7087; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Sorcerer Portal"; description="Pass through the sorcerer gate."; storageKey=7088; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Paladin Portal"; description="Pass through the paladin gate."; storageKey=7089; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Knight Portal"; description="Pass through the knight gate."; storageKey=7090; storageValue=1 }
)}

# === 17. Plains of Havoc ===
$quests += [PSCustomObject]@{ id = 17; name = "Plains of Havoc"; missions = @(
  [PSCustomObject]@{ id=1; name="The Stone Lever"; description="Pull the stone lever in the Plains of Havoc."; storageKey=7041; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Stalagmite Passage"; description="Step on the hidden tile to open the stalagmite passage."; storageKey=7001; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Jungle Grass Path"; description="Step on the hidden jungle grass to find the path."; storageKey=7002; storageValue=1 }
)}

# === 18. Venore Town ===
$quests += [PSCustomObject]@{ id = 18; name = "Venore Environs"; missions = @(
  [PSCustomObject]@{ id=1; name="The Triangle Tower"; description="Pull the lever to enter the Triangle Tower."; storageKey=7036; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Dark Cathedral"; description="Solve the dark cathedral lever puzzle."; storageKey=7086; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Netlios' Lever"; description="Pull Netlios' lever in Venore."; storageKey=7009; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Spike Sword Secret"; description="Pull the secret spike sword lever."; storageKey=7011; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Hidden Jungle Grass"; description="Step on the hidden jungle grass tile."; storageKey=7003; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Goblin Mountain"; description="Step on the hidden tile in Goblin Mountain."; storageKey=7002; storageValue=1 }
)}

# === 19. The Demon Helmet ===
$quests += [PSCustomObject]@{ id = 19; name = "The Demon Helmet"; missions = @(
  [PSCustomObject]@{ id=1; name="The Demon Lever"; description="Pull the lever to begin the Demon Helmet quest."; storageKey=7012; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Eastern Wall"; description="Remove the eastern magic wall in the demon tunnels."; storageKey=7022; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Western Wall"; description="Remove the western magic wall in the demon tunnels."; storageKey=7023; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Escape Route"; description="Find the exit from the demon helmet dungeon."; storageKey=7091; storageValue=1 }
)}

# === 20. The Annihilator ===
$quests += [PSCustomObject]@{ id = 20; name = "The Annihilator"; missions = @(
  [PSCustomObject]@{ id=1; name="The Challenge Lever"; description="Pull the lever to start the Annihilator challenge."; storageKey=7015; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Escape the Arena"; description="Find the exit after surviving the Annihilator."; storageKey=7083; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Annihilator Reward"; description="Claim your reward from the Annihilator chests."; storageKey=203; storageValue=1 }
)}

# === 21. Edron Quests ===
$quests += [PSCustomObject]@{ id = 21; name = "Edron Quests"; missions = @(
  [PSCustomObject]@{ id=1; name="Ghostlands"; description="Pull the lever to enter the Ghostlands."; storageKey=7018; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Ghostlands Beholder"; description="Pull the beholder lever in the Ghostlands."; storageKey=7026; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Behemoth's Bane"; description="Pull the lever to challenge the behemoth."; storageKey=7013; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Goblin Cave Passage"; description="Pull the lever to open the goblin cave passage."; storageKey=7014; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Demona Entrance"; description="Pull the lever to enter the Demona fortress."; storageKey=7016; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Demona Energy Trap"; description="Pull the lever to disable the energy trap."; storageKey=7017; storageValue=1 }
  [PSCustomObject]@{ id=7; name="The Demon Scroll"; description="Step on the tile to summon and defeat the demons."; storageKey=7121; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Statue Removal"; description="Step on the tile to move the statue."; storageKey=7025; storageValue=1 }
)}

# === 22. The Paradox Tower ===
$quests += [PSCustomObject]@{ id = 22; name = "The Paradox Tower"; missions = @(
  [PSCustomObject]@{ id=1; name="The Box Puzzle"; description="Solve the box puzzle in the Paradox Tower."; storageKey=7047; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Lever Puzzle"; description="Solve the lever puzzle in the Paradox Tower."; storageKey=7048; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Food Offering"; description="Solve the food puzzle in the Paradox Tower."; storageKey=7049; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Chessboard"; description="Solve the chess puzzle in the Paradox Tower."; storageKey=7050; storageValue=1 }
  [PSCustomObject]@{ id=5; name="The Dead Tree"; description="Step on the hidden tile behind the dead tree."; storageKey=7004; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Tower Entrance"; description="Step on the entrance tile to enter the Paradox Tower."; storageKey=7005; storageValue=1 }
  [PSCustomObject]@{ id=7; name="The Crate Puzzle"; description="Solve the crate puzzle."; storageKey=7048; storageValue=1 }
  [PSCustomObject]@{ id=8; name="The Skull Gate"; description="Step on the skull entrance tile."; storageKey=7049; storageValue=1 }
  [PSCustomObject]@{ id=9; name="The Stair Opener"; description="Step on the tile to reveal the tower stairs."; storageKey=7035; storageValue=1 }
  [PSCustomObject]@{ id=10; name="Escape the Tower"; description="Step on the exit tile to leave the Paradox Tower."; storageKey=7050; storageValue=1 }
  [PSCustomObject]@{ id=11; name="Reward Chest I"; description="Open the first reward chest."; storageKey=3036; storageValue=1 }
  [PSCustomObject]@{ id=12; name="Reward Chest II"; description="Open the second reward chest."; storageKey=3037; storageValue=1 }
  [PSCustomObject]@{ id=13; name="Reward Chest III"; description="Open the third reward chest."; storageKey=3038; storageValue=1 }
  [PSCustomObject]@{ id=14; name="Reward Chest IV"; description="Open the fourth reward chest."; storageKey=3039; storageValue=1 }
  [PSCustomObject]@{ id=15; name="Reward Chest V"; description="Open the fifth reward chest."; storageKey=3040; storageValue=1 }
  [PSCustomObject]@{ id=16; name="Reward Chest VI"; description="Open the sixth reward chest."; storageKey=3041; storageValue=1 }
  [PSCustomObject]@{ id=17; name="Reward Chest VII"; description="Open the seventh reward chest."; storageKey=3042; storageValue=1 }
  [PSCustomObject]@{ id=18; name="Reward Chest VIII"; description="Open the eighth reward chest."; storageKey=3043; storageValue=1 }
  [PSCustomObject]@{ id=19; name="Reward Chest IX"; description="Open the ninth reward chest."; storageKey=3044; storageValue=1 }
  [PSCustomObject]@{ id=20; name="Reward Chest X"; description="Open the tenth reward chest."; storageKey=3045; storageValue=1 }
  [PSCustomObject]@{ id=21; name="Reward Chest XI"; description="Open the eleventh reward chest."; storageKey=3046; storageValue=1 }
  [PSCustomObject]@{ id=22; name="Reward Chest XII"; description="Open the twelfth reward chest."; storageKey=3047; storageValue=1 }
)}

# === 23. Kazordoon ===
$quests += [PSCustomObject]@{ id = 23; name = "Kazordoon"; missions = @(
  [PSCustomObject]@{ id=1; name="Elevator Descent"; description="Pull the lever to go down in the Kazordoon elevator."; storageKey=7032; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Stone Lever"; description="Pull the stone lever in Kazordoon."; storageKey=7033; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Ladder Lever"; description="Pull the lever to extend the ladder."; storageKey=7034; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Elevator Ascent"; description="Pull the lever to go up in the elevator."; storageKey=7035; storageValue=1 }
)}

# === 24. The Pharaoh Tombs ===
$quests += [PSCustomObject]@{ id = 24; name = "The Pharaoh Tombs"; missions = @(
  [PSCustomObject]@{ id=1; name="Thalas' Puzzle"; description="Solve Thalas' lever puzzle."; storageKey=7063; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Escape Thalas"; description="Find the exit from Thalas' tomb."; storageKey=7064; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Escape Vashresamun"; description="Find the exit from Vashresamun's tomb."; storageKey=7071; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Escape Mahrdis"; description="Find the exit from Mahrdis' tomb."; storageKey=7067; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Escape Morguthis"; description="Find the exit from Morguthis' tomb."; storageKey=7069; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Escape Omruc"; description="Find the exit from Omruc's tomb."; storageKey=7066; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Escape Rahemos"; description="Find the exit from Rahemos' tomb."; storageKey=7074; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Escape Dipthrah"; description="Find the exit from Dipthrah's tomb."; storageKey=7072; storageValue=1 }
  [PSCustomObject]@{ id=9; name="Escape Ashmunrah"; description="Find the exit from Ashmunrah's tomb."; storageKey=7068; storageValue=1 }
  [PSCustomObject]@{ id=10; name="Thalas' Scarab Coin"; description="Place the scarab coin at Thalas' seal."; storageKey=7053; storageValue=1 }
  [PSCustomObject]@{ id=11; name="Vashresamun's Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7054; storageValue=1 }
  [PSCustomObject]@{ id=12; name="Mahrdis' Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7055; storageValue=1 }
  [PSCustomObject]@{ id=13; name="Morguthis' Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7056; storageValue=1 }
  [PSCustomObject]@{ id=14; name="Temple Scarab Coin"; description="Place the scarab coin at the temple seal."; storageKey=7057; storageValue=1 }
  [PSCustomObject]@{ id=15; name="Rahemos' Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7058; storageValue=1 }
  [PSCustomObject]@{ id=16; name="Omruc's Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7059; storageValue=1 }
  [PSCustomObject]@{ id=17; name="Dipthrah's Scarab Coin"; description="Place the scarab coin at the seal."; storageKey=7060; storageValue=1 }
  [PSCustomObject]@{ id=18; name="Sacrificial Altar"; description="Use the sacrificial altar."; storageKey=7061; storageValue=1 }
  [PSCustomObject]@{ id=19; name="The Second Altar"; description="Use the second sacrificial altar."; storageKey=7062; storageValue=1 }
  [PSCustomObject]@{ id=20; name="Deathslicer Puzzle"; description="Solve the deathslicer puzzle."; storageKey=7065; storageValue=1 }
)}

# === 25. Helmet of the Ancients ===
$quests += [PSCustomObject]@{ id = 25; name = "Helmet of the Ancients"; missions = @(
  [PSCustomObject]@{ id=1; name="Piece #1"; description="Find the first piece."; storageKey=232; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Piece #2"; description="Find the second piece."; storageKey=243; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Piece #3"; description="Find the third piece."; storageKey=247; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Piece #4"; description="Find the fourth piece."; storageKey=261; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Piece #5"; description="Find the fifth piece."; storageKey=262; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Piece #6"; description="Find the sixth piece."; storageKey=263; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Piece #7"; description="Find the seventh piece."; storageKey=264; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Piece #8"; description="Find the eighth piece."; storageKey=265; storageValue=1 }
  [PSCustomObject]@{ id=9; name="Piece #9"; description="Find the ninth piece."; storageKey=266; storageValue=1 }
  [PSCustomObject]@{ id=10; name="Piece #10"; description="Find the tenth piece."; storageKey=267; storageValue=1 }
  [PSCustomObject]@{ id=11; name="The Final Assembly"; description="Assemble all pieces to create the Helmet."; storageKey=7018; storageValue=1 }
)}

# === 26. The Dark Pyramid ===
$quests += [PSCustomObject]@{ id = 26; name = "The Dark Pyramid"; missions = @(
  [PSCustomObject]@{ id=1; name="Eastern Wall"; description="Pass through the eastern wall."; storageKey=7019; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Western Wall"; description="Pass through the western wall."; storageKey=7020; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Key Passage"; description="Find the key and exit the Dark Pyramid."; storageKey=7103; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Lever Puzzle"; description="Solve the lever puzzle."; storageKey=7104; storageValue=1 }
)}

# === 27. Desert Symphony ===
$quests += [PSCustomObject]@{ id = 27; name = "Desert Symphony"; missions = @(
  [PSCustomObject]@{ id=1; name="The Drum"; description="Play the drum."; storageKey=7070; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Trumpet"; description="Play the trumpet."; storageKey=7071; storageValue=1 }
  [PSCustomObject]@{ id=3; name="The Horn"; description="Play the horn."; storageKey=7072; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Mandolin"; description="Play the mandolin."; storageKey=7073; storageValue=1 }
  [PSCustomObject]@{ id=5; name="The Second Horn"; description="Play the second horn."; storageKey=7074; storageValue=1 }
  [PSCustomObject]@{ id=6; name="The Lyre"; description="Play the lyre."; storageKey=7075; storageValue=1 }
  [PSCustomObject]@{ id=7; name="The Panpipes"; description="Play the panpipes."; storageKey=7076; storageValue=1 }
  [PSCustomObject]@{ id=8; name="The Flute"; description="Play the flute."; storageKey=7077; storageValue=1 }
)}

# === 28. The Mystic Flames ===
$quests += [PSCustomObject]@{ id = 28; name = "The Mystic Flames"; missions = @(
  [PSCustomObject]@{ id=1; name="Flame I"; description="Step on the first flame tile."; storageKey=7076; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Flame II"; description="Step on the second flame tile."; storageKey=7077; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Flame III"; description="Step on the third flame tile."; storageKey=7078; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Flame IV"; description="Step on the fourth flame tile."; storageKey=7079; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Flame V"; description="Step on the fifth flame tile."; storageKey=7080; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Flame VI"; description="Step on the sixth flame tile."; storageKey=7081; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Flame VII"; description="Step on the seventh flame tile."; storageKey=7082; storageValue=1 }
)}

# === 29. Ankrahmun Secrets ===
$quests += [PSCustomObject]@{ id = 29; name = "Ankrahmun Secrets"; missions = @(
  [PSCustomObject]@{ id=1; name="The Wasp Lever"; description="Pull the wasp lever."; storageKey=7001; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Scarab Monument"; description="Pull the scarab monument lever."; storageKey=7002; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Serpentine Tower"; description="Pull the fire elemental lever."; storageKey=7003; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Magician's Hat"; description="Solve the magician hat puzzle."; storageKey=7004; storageValue=1 }
  [PSCustomObject]@{ id=5; name="The Secret Switch"; description="Pull the secret switch."; storageKey=7043; storageValue=1 }
  [PSCustomObject]@{ id=6; name="The Water Basin"; description="Fill a container at the water basin."; storageKey=7067; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Gemmed Lamp I"; description="Use the first gemmed lamp."; storageKey=7068; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Gemmed Lamp II"; description="Use the second gemmed lamp."; storageKey=7069; storageValue=1 }
  [PSCustomObject]@{ id=9; name="Morgathla's Seal"; description="Step on Morgathla's tile."; storageKey=7014; storageValue=1 }
  [PSCustomObject]@{ id=10; name="The Cobra's Venom"; description="Survive the poison floor."; storageKey=7015; storageValue=1 }
  [PSCustomObject]@{ id=11; name="Pacman East"; description="Take the eastern teleport."; storageKey=7016; storageValue=1 }
  [PSCustomObject]@{ id=12; name="Pacman West"; description="Take the western teleport."; storageKey=7017; storageValue=1 }
)}

# === 30. The Door Hallway ===
$quests += [PSCustomObject]@{ id = 30; name = "The Door Hallway"; missions = @(
  [PSCustomObject]@{ id=1; name="The Wrong Door"; description="Step on the wrong door."; storageKey=7122; storageValue=1 }
  [PSCustomObject]@{ id=2; name="The Correct Door"; description="Step on the correct door."; storageKey=7123; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Hallway Teleport"; description="Step on the hallway teleport."; storageKey=7075; storageValue=1 }
)}

# === 31. The Banshee's Curse ===
$quests += [PSCustomObject]@{ id = 31; name = "The Banshee's Curse"; missions = @(
  [PSCustomObject]@{ id=1; name="Lever Puzzle I"; description="Solve the first lever puzzle."; storageKey=7019; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Lever Puzzle II"; description="Solve the second lever puzzle."; storageKey=7020; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Lever Puzzle III"; description="Solve the third lever puzzle."; storageKey=7021; storageValue=1 }
  [PSCustomObject]@{ id=4; name="Lever Puzzle IV"; description="Solve the fourth lever puzzle."; storageKey=7022; storageValue=1 }
  [PSCustomObject]@{ id=5; name="Lever Puzzle V"; description="Solve the fifth lever puzzle."; storageKey=7023; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Lever Puzzle VI"; description="Solve the sixth lever puzzle."; storageKey=7024; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Secret Seal Lever"; description="Pull the secret seal lever."; storageKey=7025; storageValue=1 }
  [PSCustomObject]@{ id=8; name="Stepback Illusion South"; description="Step on the southern illusion tile."; storageKey=7006; storageValue=1 }
  [PSCustomObject]@{ id=9; name="Stepback Illusion North"; description="Step on the northern illusion tile."; storageKey=7007; storageValue=1 }
  [PSCustomObject]@{ id=10; name="Hole Removal South"; description="Step on the tile to seal the hole."; storageKey=7008; storageValue=1 }
  [PSCustomObject]@{ id=11; name="Hole Removal North"; description="Step on the tile to seal the hole."; storageKey=7009; storageValue=1 }
  [PSCustomObject]@{ id=12; name="Entrance Restore I"; description="Step on the first restoration tile."; storageKey=7010; storageValue=1 }
  [PSCustomObject]@{ id=13; name="Entrance Restore II"; description="Step on the second restoration tile."; storageKey=7011; storageValue=1 }
  [PSCustomObject]@{ id=14; name="Summon Warlock"; description="Step on the summon tile."; storageKey=7026; storageValue=1 }
  [PSCustomObject]@{ id=15; name="Tile Puzzle Start"; description="Step on the first tile."; storageKey=7027; storageValue=1 }
  [PSCustomObject]@{ id=16; name="Tile Puzzle Correct"; description="Step on the correct tile."; storageKey=7028; storageValue=1 }
  [PSCustomObject]@{ id=17; name="Tile Puzzle Incorrect"; description="Survive the incorrect tile."; storageKey=7029; storageValue=1 }
  [PSCustomObject]@{ id=18; name="Blood Tile"; description="Step on the blood tile."; storageKey=7030; storageValue=1 }
  [PSCustomObject]@{ id=19; name="The Ghost Seal"; description="Activate the ghost seal."; storageKey=7098; storageValue=1 }
  [PSCustomObject]@{ id=20; name="The Blood Seal"; description="Activate the blood seal."; storageKey=7099; storageValue=1 }
  [PSCustomObject]@{ id=21; name="The Warlock Seal"; description="Activate the warlock seal."; storageKey=7100; storageValue=1 }
  [PSCustomObject]@{ id=22; name="The Tiles Seal"; description="Activate the tiles seal."; storageKey=7101; storageValue=1 }
  [PSCustomObject]@{ id=23; name="The Pearls Seal"; description="Activate the pearls seal."; storageKey=7102; storageValue=1 }
  [PSCustomObject]@{ id=24; name="Pearls Puzzle I"; description="Solve the pearls puzzle."; storageKey=7095; storageValue=1 }
  [PSCustomObject]@{ id=25; name="Pearls Puzzle II"; description="Solve the second pearls puzzle."; storageKey=7096; storageValue=1 }
  [PSCustomObject]@{ id=26; name="Banshee Lever Puzzle"; description="Pull the main lever puzzle."; storageKey=7097; storageValue=1 }
  [PSCustomObject]@{ id=27; name="Escape the Banshee"; description="Find the exit."; storageKey=7094; storageValue=1 }
  [PSCustomObject]@{ id=28; name="Restore Magic Walls"; description="Restore the magic walls."; storageKey=7024; storageValue=1 }
  [PSCustomObject]@{ id=29; name="Sub-Lever #1"; description="Pull the first sub-lever."; storageKey=7027; storageValue=1 }
  [PSCustomObject]@{ id=30; name="Sub-Lever #2"; description="Pull the second sub-lever."; storageKey=7028; storageValue=1 }
  [PSCustomObject]@{ id=31; name="Sub-Lever #3"; description="Pull the third sub-lever."; storageKey=7029; storageValue=1 }
  [PSCustomObject]@{ id=32; name="Sub-Lever #4"; description="Pull the fourth sub-lever."; storageKey=7030; storageValue=1 }
  [PSCustomObject]@{ id=33; name="Sub-Lever #5"; description="Pull the fifth sub-lever."; storageKey=7031; storageValue=1 }
)}

# === 32. Port Hope ===
$quests += [PSCustomObject]@{ id = 32; name = "Port Hope"; missions = @(
  [PSCustomObject]@{ id=1; name="Banuta 999 Entrance"; description="Pull the lever to enter."; storageKey=7005; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Banuta 999 Exit"; description="Pull the lever to exit."; storageKey=7006; storageValue=1 }
  [PSCustomObject]@{ id=3; name="Kongra Teleport"; description="Enter the Kongra teleport."; storageKey=7084; storageValue=1 }
  [PSCustomObject]@{ id=4; name="The Canopic Jar"; description="Solve the canopic jar puzzle."; storageKey=7085; storageValue=1 }
  [PSCustomObject]@{ id=5; name="The Dworc Hole"; description="Pull the lever to open the hole."; storageKey=7042; storageValue=1 }
  [PSCustomObject]@{ id=6; name="Orichalcum Pearl I"; description="Enter the first pearl portal."; storageKey=7092; storageValue=1 }
  [PSCustomObject]@{ id=7; name="Orichalcum Pearl II"; description="Enter the second pearl portal."; storageKey=7093; storageValue=1 }
)}

# === 33. Isle of Kings ===
$quests += [PSCustomObject]@{ id = 33; name = "Isle of Kings"; missions = @(
  [PSCustomObject]@{ id=1; name="First Trespass"; description="Step on the first trespass tile."; storageKey=7031; storageValue=1 }
  [PSCustomObject]@{ id=2; name="Second Trespass"; description="Step on the second trespass tile."; storageKey=7032; storageValue=1 }
)}

# === 34. Senja ===
$quests += [PSCustomObject]@{ id = 34; name = "Senja"; missions = @(
  [PSCustomObject]@{ id=1; name="The Magic Walls"; description="Pull the lever to dispel the magic walls."; storageKey=7039; storageValue=1 }
)}

# === 35. GM Island ===
$quests += [PSCustomObject]@{ id = 35; name = "GM Island"; missions = @(
  [PSCustomObject]@{ id=1; name="The Torture Chamber"; description="Pull the lever in the torture chamber."; storageKey=7038; storageValue=1 }
)}

# === 40. Rookie's Fortune (chests 14-44) ===
$rt = @()
$rtNames = @{14="The First Key";15="Explorer's Backpack";16="The Second Key";17="Dwarven Shield";18="Highscore Label";19="The Third Key";20="Rings of Power";21="Crystal Ring I";22="Crystal Ring II";23="Bread and Gold";24="Silver and Leather";25="Troll Spoils";26="Potion and Runes";27="Silver Brooch";28="The Fourth Key";29="Snakebite Rod";30="Mace";31="Halberd";32="Fishing Rod";33="Bread Supply";34="Brass Shield";35="Chain Armor";36="The Fifth Key";37="Adventurer's Kit";38="The Sixth Key";39="The Seventh Key";40="The Eighth Key";41="Convince Scroll";42="Platinum";43="Gold Coins";44="Strange Symbol"}
$i=1
foreach ($kv in ($rtNames.GetEnumerator() | Sort-Object Name)) {
  $rt += [PSCustomObject]@{ id=$i; name=$kv.Value; description="Open the treasure chest to claim your reward."; storageKey=[int]$kv.Name; storageValue=1 }
  $i++
}
$quests += [PSCustomObject]@{ id=40; name="Rookie's Fortune"; missions=$rt }

# === 41. Adventurer's Spoils (chests 46-99) ===
$as = @()
$asNames = @{46="The Torn Diary";49="The Ninth Key";50="Strange Helmet";51="Knight's Cache";52="The Tenth Key";53="Noble Axe Cache";54="The Eleventh Key";55="The Twelfth Key";56="The Thirteenth Key";57="The Fourteenth Key";58="Ham Supply";59="Studded Shield";60="Sabre";61="The Fifteenth Key";65="Fresh Bread";67="Shovel";68="The Fox's Note";69="Hand Axe";70="Gold Coins I";71="Gold Coins II";72="Steel Helmet";73="Bone Shield";74="Warrior's Kit";75="Pearls and Gold";76="The Sixteenth Key";77="Guardian's Cache";78="Stealth and Runes";79="Demon Shields";80="Scale Armor";81="Battle Hammer";82="Black Pearls";83="Mushrooms";84="Healing Rune";85="Knight Armor";86="Great Fireball Rune";87="Dark Shield";88="Magic Longsword";89="Magic Plate Armor";90="Explosion Rune";91="Provisions";92="Crowbar and Emeralds";93="Tool Kit";94="Gold Cache";95="Crown Shield";96="Black Shield";97="Watch and Scroll";98="Present and Sapphires";99="Might Ring"}
$i=1
foreach ($kv in ($asNames.GetEnumerator() | Sort-Object Name)) {
  $as += [PSCustomObject]@{ id=$i; name=$kv.Value; description="Open the treasure chest to claim your reward."; storageKey=[int]$kv.Name; storageValue=1 }
  $i++
}
$quests += [PSCustomObject]@{ id=41; name="Adventurer's Spoils"; missions=$as }

# === 42. Hero's Hoard (chests 100-199) ===
$hh = @()
$hhNames = @{100="Executioner Shield";106="Knight Legs";107="Blue Robe";108="Giant Sword";109="Mage's Cache";110="Golden Armor";111="Thunderstorm Runes";112="Spellbook";113="Black Pearls";114="Crown Armor";115="Jewelry Cache";116="Gold";117="Fire Axe";118="Gold Coin";119="Hengis' Diary";120="Platinum Coins";121="Crown Cache";122="Crown Legs";123="Spell Cache";124="Krendorak's Journal";125="Giant Smithhammer";126="Sudden Death Runes";127="Dragon Scale Legs";128="Dragon Lance";129="The 17th Key";130="The 18th Key";131="The 19th Key";132="The 20th Key";133="Energy Ring";134="Scroll and Pearl";135="Green Shield";136="Dragon Scale Boots";137="Golden Legs";138="Might Ring";139="Serpent Sword";140="Skull Staff";141="Great Fireballs";142="Emeralds";143="White Pearl";144="Royal Spears";145="Emeralds II";146="Demon Armor";147="Mastermind Potion";148="Blank Runes";149="Ice Rapier";150="Mace";151="Fire Devil";152="Heavy Mace";153="Bone Shield";154="Fire Sword";155="Bright Sword";156="Magic Sword";157="Obsidian Lance";158="Dragon Scale Boots II";159="Map of Tibia";160="Map of Glory";161="Bucket";162="Ferumbras' Letter";163="Stonecutter Axe";164="Spellbook II";165="Stealth Ring";166="Glorious Axe Cache";167="Fire Devil II";168="Steel Helmet";169="Dark Armor";170="Tower Shield";171="Golden Sickle";172="Scale Armor";173="Explosion Runes";174="Scroll";175="The 21st Key";176="Crown Helmet";177="Obsidian Knife";178="Mycological Mace";179="Energy Ring II";180="Skull Staff II";181="Stone Skin Amulets";182="Life Potions";183="Magic Plate Armor II";184="Convince Scroll II";185="Pick";186="Great Fireballs II";187="Assassin Star";188="Steel Helmet II";189="Demonbone";190="Platinum II";191="Mage's War Cache";192="The 22nd Key";193="Blank Runes II";194="Spellbook III";195="Tower Shield II";196="Dragon Shield";197="Demonbone II";198="Platinum III"}
$i=1
foreach ($kv in ($hhNames.GetEnumerator() | Sort-Object Name)) {
  $hh += [PSCustomObject]@{ id=$i; name=$kv.Value; description="Open the treasure chest to claim your reward."; storageKey=[int]$kv.Name; storageValue=1 }
  $i++
}
$quests += [PSCustomObject]@{ id=42; name="Hero's Hoard"; missions=$hh }

# === 43. Champion's Tribute (chests 200-332) ===
$ct = @()
$ctNames = @{200="Scale Armor II";201="Warrior Helmet";202="Vampire Shield";206="Smithhammer Cache";207="Monk's Diary";208="The 23rd Key";209="Bridge Riddle";210="The 24th Key";213="Bread Cache";214="Dreammaster's Journal";215="Scarab Amulet";216="Musician's Cache";221="The 25th Key";223="Spike Sword";224="Heavy Old Tome";225="Soft Boots";226="The 26th Key";232="Helmet Piece #1";243="Helmet Piece #2";247="Helmet Piece #3";253="Scroll and Emeralds";254="War Hammer";255="Bug Report";257="Black Pearl";261="Helmet Piece #4";262="Helmet Piece #5";263="Helmet Piece #6";264="Helmet Piece #7";265="Helmet Piece #8";266="Helmet Piece #9";267="Helmet Piece #10";268="Arkhothep's Lore";269="Ancient Poem";290="Hellforged Axe";291="The 27th Key";292="Ancient Tiaras";294="Arcane Staff";295="Shadow Strike";298="Hellforged Amulet";312="Soulstone";314="Void Boots";319="Dragon Scale";324="Dark Armor";326="Frost Giant Plate";328="Lightning Legs";329="Dragon Slayer";330="Demon Trophy";331="Bone Armor";332="The Justice"}
$i=1
foreach ($kv in ($ctNames.GetEnumerator() | Sort-Object Name)) {
  $ct += [PSCustomObject]@{ id=$i; name=$kv.Value; description="Open the treasure chest to claim your reward."; storageKey=[int]$kv.Name; storageValue=1 }
  $i++
}
$quests += [PSCustomObject]@{ id=43; name="Champion's Tribute"; missions=$ct }

# === 44. The Dog Track ===
$quests += [PSCustomObject]@{ id = 44; name = "The Dog Track"; missions = @(
  [PSCustomObject]@{ id=1; name="Starting Lever"; description="Pull the lever to start the dog race."; storageKey=7040; storageValue=1 }
  [PSCustomObject]@{ id=2; name="North Lap"; description="Step on the northern lap tile."; storageKey=7119; storageValue=1 }
  [PSCustomObject]@{ id=3; name="South Lap"; description="Step on the southern lap tile."; storageKey=7120; storageValue=1 }
)}

# Write JSON
$json = $quests | ConvertTo-Json -Depth 10
Set-Content $questsFile $json
Write-Host "Written $($quests.Count) quests with $(($quests | % { $_.missions.Count } | Measure-Object -Sum).Sum) missions."
