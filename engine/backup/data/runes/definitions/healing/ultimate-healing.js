const CombatFormulas = requireModule("combat/combat-formulas");

module.exports = function ultimateHealing(source, target) {

  let top = target.getTopCreature();
  if (top === null) {
    return false;
  }

  process.gameServer.world.sendMagicEffect(target.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);

  let heal = Math.abs(CombatFormulas.getMagicDamage(source, 2.00, 0, 3.00, 0));
  top.increaseHealth(heal);
  top.broadcast(new (requireModule("network/protocol")).EmotePacket(top, "+" + heal, CONST.COLOR.LIGHTGREEN));

  return true;

}