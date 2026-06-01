const CombatFormulas = requireModule("combat/combat-formulas");
const AREAS = requireModule("combat/area-definitions");
const Condition = requireModule("combat/condition");

module.exports = function poisonStorm() {
  let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
  let offsets = AREAS.resolveArea(AREAS.CIRCLE6X6, direction);
  let world = process.gameServer.world;
  offsets = AREAS.filterBlocked(world, this.position, offsets);
  let hitAny = false;
  let blockedPz = false;
  let seen = new Set();

  let condition = new Condition(Condition.prototype.POISONED, 3, 3);
  condition.damage = Math.abs(CombatFormulas.getMagicDamage(this, 1.50, 0, 2.50, 0));

  offsets.forEach(function (off) {
    let pos = { x: this.position.x + off.x, y: this.position.y + off.y, z: this.position.z };
    world.sendMagicEffect(pos, CONST.EFFECT.MAGIC.GREEN_RINGS);
    let tile = world.getTileFromWorldPosition(pos);
    if (!tile || !tile.creatures) return;
    tile.creatures.forEach(function (creature) {
      if (seen.has(creature.id)) return;
      seen.add(creature.id);
      if (creature.id === this.id) return;

      if (creature.isPlayer && creature.isPlayer()) {
        blockedPz = true;
      }

      creature.addCondition(condition);

      hitAny = true;
    }, this);
  }, this);

  if (blockedPz) {
    this.setInFight(true);
  }

  if (hitAny) {
    return 500;
  }

  return 0;
}
