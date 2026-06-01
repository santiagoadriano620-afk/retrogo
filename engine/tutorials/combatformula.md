# Combat Formulas — TFS 1.4.2 (The Violet Project)

Todas as fórmulas abaixo foram portadas do C++ do TFS 1.4.2 para JavaScript. O código-fonte TFS está em `tfs/src/` para referência.

---

## 1. Ataque Corpo a Corpo (Melee)

### Cálculo do dano máximo da arma
```
maxDamage = round(level/5 + ((skill/4+1)*(attack/3)*1.03)/attackFactor)
```

**Arquivo:** `engine/src/combat/combat-formulas.js:54-58`
**TFS fonte:** `tfs/src/weapons.cpp:127`

### Attack Factor (modo de combate)
| Modo | Nosso | TFS | Multiplicador |
|------|-------|-----|---------------|
| OFFENSIVE (0) | `getAttackFactor(0)` | `FIGHTMODE_ATTACK` | 1.0 |
| BALANCED (1) | `getAttackFactor(1)` | `FIGHTMODE_BALANCED` | 1.2 |
| DEFENSIVE (2) | `getAttackFactor(2)` | `FIGHTMODE_DEFENSE` | 2.0 |

**Arquivo:** `combat-formulas.js:36-43`
**TFS fonte:** `tfs/src/player.cpp:363-371`

### Dano final (melee)
```
damage = -random(0, maxWeaponDamage * vocation.meleeDamageMultiplier)
```

Onde `maxWeaponDamage` já inclui level, skill, ataque da arma e attackFactor.

**Arquivo:** `combat-formulas.js:67-77`
**TFS fonte:** `tfs/src/weapons.cpp:482-498`

---

## 2. Ataque à Distância (Distance)

### Cálculo do dano máximo
```
maxDamage = round(level/5 + ((skill/4+1)*(attack/3)*1.03)/attackFactor)
```
Mesma fórmula do melee, mas usando `SKILL_DISTANCE` e `distDamageMultiplier`.

### Dano final (distance)
```
minValue = target.isPlayer() ? ceil(level * 0.1) : ceil(level * 0.2)
maxValue = round(maxDamage * vocation.distDamageMultiplier)
damage = random(minValue, maxValue)
```

**Arquivo:** `combat-formulas.js:79-98`
**TFS fonte:** `tfs/src/weapons.cpp:645-661`

### Chance de acerto (hit chance)
```
distancia = max(|dx|, |dy|)
if (distancia <= 1) distancia = 5

skillCheck = random(0, distancia * 15) <= distanceSkill
chanceCheck = random(0, 100) <= hitChance
acertou = skillCheck && chanceCheck
```

Onde `hitChance` é:
- Arma de duas mãos (ammo): `item.hitChance + bow.hitChance + 90`, max 100
- Arma arremesso: `item.hitChance + 75`, max 100

**Arquivo:** `engine/src/core/world-combat-handler.js:81-98`
**TFS fonte:** `tfs/src/weapons.cpp:549-584`

---

## 3. Ataque Mágico (Spells)

### COMBAT_FORMULA_LEVELMAGIC
```
levelFormula = level * 2 + magicLevel * 3
minDamage = levelFormula * mina + minb
maxDamage = levelFormula * maxa + maxb
damage = -random(minDamage, maxDamage)
```

**Arquivo:** `combat-formulas.js:100-109`
**TFS fonte:** `tfs/src/combat.cpp:116-117`

### COMBAT_FORMULA_SKILL (para berserk / habilidades de arma)
```
weaponMaxDamage = getMaxWeaponDamage(level, skill, attack, attackFactor) * meleeMultiplier
maxDamage = weaponMaxDamage * maxa + maxb
minDamage = minb
damage = -random(minDamage, maxDamage)
```

**Arquivo:** `combat-formulas.js:111-130`
**TFS fonte:** `tfs/src/combat.cpp:118-127`

### Coeficientes dos Spells (convertidos)
| Spell | Mina | Minb | Maxa | Maxb |
|-------|------|------|------|------|
| Energy Strike | 0.35 | 0 | 0.55 | 0 |
| Flame Strike | 0.35 | 0 | 0.55 | 0 |
| Force Strike | 0.35 | 0 | 0.55 | 0 |
| Death Strike | 0.18 | 0 | 0.52 | 0 |
| Explosion | 0.40 | 0 | 0.80 | 0 |
| Energy Beam | 0.40 | 0 | 0.80 | 0 |
| Great Energy Beam | 0.40 | 0 | 2.00 | 0 |
| Energy Wave | 1.00 | 0 | 2.00 | 0 |
| Fire Wave | 0.20 | 0 | 0.40 | 0 |
| Ultimate Explosion | 2.00 | 0 | 3.00 | 0 |
| Poison Storm (cond) | 1.50 | 0 | 2.50 | 0 |
| Exura | 0.10 | 0 | 0.30 | 0 |
| Intense Healing | 0.20 | 0 | 0.60 | 0 |
| Ultimate Healing | 2.00 | 0 | 3.00 | 0 |
| Heal Friend | 0.80 | 0 | 1.60 | 0 |
| Mass Healing | 1.60 | 0 | 2.40 | 0 |
| Burst Arrow | 0.15 | 0 | 0.45 | 0 |

---

## 4. Defesa (Shielding)

### Cálculo do valor de defesa do jogador (moderno)
```
defenseValue = shield.defense + weapon.extraDefense  (se tem escudo + arma)
defenseValue = shield.defense                        (se tem só escudo)
defenseValue = weapon.defense + weapon.extraDefense  (se tem só arma)
defenseValue = 7                                     (se sem arma e sem escudo)

defenseSkill = shielding skill (se tem escudo)
defenseSkill = weapon skill   (se tem arma sem escudo)
defenseSkill = fist skill     (se sem arma e sem escudo)

defenseFactor:
  OFFENSIVE: 0.5 se atacou recentemente, senão 1.0
  BALANCED:  0.75 se atacou recentemente, senão 1.0
  DEFENSIVE: 1.0 sempre

totalDefense = round((defenseSkill/4 + 2.23) * defenseValue * 0.15 * defenseFactor * vocation.defensiveValue)
```

**Arquivo:** `combat-formulas.js:126-197`
**TFS fonte:** `tfs/src/player.cpp:296-351` (moderno), `tfs/src/player.cpp:373-381` (defenseFactor)

### Aplicação da defesa (block)
```
blockCount > 0 ? hasDefense = true, blockCount--
if (hasDefense && canUseDefense):
    redução = random(defense/2, defense)
    damage -= redução
    if (damage <= 0): BLOCK_DEFENSE (POFF), skip armor
```

**Arquivo:** `combat-formulas.js:263-273` (tryBlockDefense), `combat-formulas.js:343-417` (combatBlockHit)
**TFS fonte:** `tfs/src/creature.cpp:515-591` (Creature::blockHit)

### Regeneração do blockCount
```
a cada 1000ms:
    blockCount = min(blockCount + 1, 2)
    blockTicks = 0
```
Máximo de 2 cargas armazenadas. blockCount é decrementado a cada tentativa de defesa.

**Arquivo:** `engine/src/entities/creature.js:44-50` (`__updateBlockCount`)
**TFS fonte:** `tfs/src/creature.cpp:87-91`

---

## 5. Armadura (Armor)

### Cálculo do valor de armadura do jogador
```
armor = sum(armor de helmet + necklace + armor + legs + boots + ring)
armor = floor(armor * vocation.armorMultiplier)
```

**Arquivo:** `combat-formulas.js:210-235`
**TFS fonte:** `tfs/src/player.cpp:243-264`

### Aplicação da armadura (moderno)
```
if (armor > 3):
    redução = random(armor/2, armor - (armor % 2 + 1))
    damage -= redução
else if (armor > 0):
    damage -= 1

if (damage <= 0): BLOCK_ARMOR
```

**Arquivo:** `combat-formulas.js:238-257`
**TFS fonte:** `tfs/src/creature.cpp:560-568`

---

## 6. Imunidades e Resistências Elementais

### Imunidade
```
if (target.damageImmunities.includes(combatType)):
    damage = 0
    blockType = BLOCK_IMMUNITY
```

**Arquivo:** `combat-formulas.js:275-278`

### Resistência elemental (monstros)
```
resistance = target.elementalResistances[combatType]
damage = round(damage * (100 - resistance) / 100)
if (damage <= 0): block
```

**Arquivo:** `combat-formulas.js:431-440`
**TFS fonte:** `tfs/src/monster.cpp:570-592`

### Absorção por equipamento (jogadores)
```
para cada slot equipado:
    absorbPercent = item.absorbPercent[combatType]
    damage = round(damage * (100 - absorbPercent) / 100)
    if (damage <= 0): BLOCK_IMMUNITY
```

**Arquivo:** `combat-formulas.js:280-310`
**TFS fonte:** `tfs/src/player.cpp:1703-1776` (Player::blockHit)

---

## 7. Divisão PvP

```
if (casterPlayer && targetPlayer && caster != target && damageType != HEALING):
    damage = round(damage / 2)
```

Aplica-se a TODOS os tipos de dano (físico, mágico, distância) exceto cura.

**Arquivo:** `combat-formulas.js:317-327`
**TFS fonte:** `tfs/src/combat.cpp:853-856`

---

## 8. Ataque Crítico

```
chance = player.getSpecialSkill("criticalHitChance")
skill = player.getSpecialSkill("criticalHitAmount")
if (random(0, 100) < chance):
    damage += round(damage * skill / 100)
    critical = true
```

**Arquivo:** `combat-formulas.js:329-340`
**TFS fonte:** `tfs/src/combat.cpp:859-866`

---

## 9. Pipeline Completo

A ordem de processamento segue TFS exatamente:

```
1. combatBlockHit
   a. Imunidade → BLOCK_IMMUNITY (POFF)
   b. Defesa (se blockedByShield):
      - blockCount > 0? hasDefense = true, blockCount--
      - random(defense/2, defense) subtrai
      - damage ≤ 0? → BLOCK_DEFENSE (POFF), skip armor
   c. Armadura (se blockedByArmor):
      - random(armor/2, armor-(armor%2+1)) subtrai
      - damage ≤ 0? → BLOCK_ARMOR
   d. Absorção por equipamento (se player alvo)
   e. Resistência elemental (se monstro alvo)
2. Se bloqueado → retorna POFF/BLOCKHIT, não continua
3. Divisão PvP (damage /= 2 se player vs player)
4. Ataque crítico
5. combatChangeHealth → decreaseHealth
```

**Arquivo:** `engine/src/core/world-combat-handler.js` (full pipeline)
**TFS fonte:** `tfs/src/combat.cpp:830-869` (doTargetCombat)

---

## 10. Dano Ambiental e de Monstros

### Ataque básico de monstro
```
damage = random(0, monster.getAttack())
```

**Arquivo:** `engine/src/entities/creature.js:319-327`

### Ataque especial de monstro (spell)
```
damage = -random(minCombatValue, maxCombatValue)
```

**Arquivo:** `combat-formulas.js:312-315`

### Dano ambiental (fire/poison/energy fields)
```
damage = -amount
combatType = UNDEFINED (sem block)
```
Pula o pipeline de block (não aplica defesa/armadura/resistências).

**Arquivo:** `engine/src/core/world-combat-handler.js:221-231`

---

## 11. Mana Shield

Aplica-se dentro de `Creature.decreaseHealth()` / `Player.decreaseHealth()`:
```
if (targetPlayer && hasCondition(MANA_SHIELD)):
    manaAbsorbed = min(damage, currentMana)
    currentMana -= manaAbsorbed
    remainingDamage = damage - manaAbsorbed
    if (remainingDamage <= 0): return  // todo dano absorvido
```

---

## Vocations Multipliers

| Vocação | meleeDamage | distanceDamage | defensiveValue | armor |
|---------|------------|----------------|----------------|-------|
| Knight | 1.25 | 1.0 | 1.0 | 1.1 |
| Paladin | 1.1 | 1.4 | 1.0 | 1.1 |
| Sorcerer | 1.0 | 1.0 | 1.25 | 1.0 |
| Druid | 1.0 | 1.0 | 1.25 | 1.0 |
| None (rook) | 1.0 | 1.0 | 1.0 | 1.0 |

**Arquivo:** `combat-formulas.js:28-34`

---

## Arquivos Relevantes

| Arquivo | Propósito |
|---------|-----------|
| `engine/src/combat/combat-formulas.js` | Todas as fórmulas (dano, defesa, armadura, magia, resistências) |
| `engine/src/core/world-combat-handler.js` | Pipeline completo: melee, distance, PvP, crítico |
| `engine/src/entities/creature.js` | blockCount, blockTicks, __updateBlockCount, decreaseHealth |
| `engine/src/player/player.js` | getMaxWeaponDamage, calculateDamage, decreaseHealth (mana shield) |
| `engine/src/monster/monster.js` | Monster.think (blockCount regen), __applyAttackEffect |
| `engine/src/core/world.js` | __damageEntity (runes) |
| `tfs/src/combat.cpp` | TFS original: formulas LEVELMAGIC/SKILL, PvP div, crit |
| `tfs/src/creature.cpp` | TFS original: blockHit, blockCount regen |
| `tfs/src/weapons.cpp` | TFS original: getMaxWeaponDamage, distance hit chance |
| `tfs/src/player.cpp` | TFS original: getDefense, getArmor, getAttackFactor, getDefenseFactor |
| `data/spells/definitions/attack/*.js` | Spells convertidos para TFS LEVELMAGIC coefficients |
