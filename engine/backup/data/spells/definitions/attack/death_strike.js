module.exports = function deathStrike(properties) {

    let direction = this.getProperty(CONST.PROPERTIES.DIRECTION);
    let targetPosition = this.position.getPositionFromDirection(direction);

    if (targetPosition === null) {
        return 0;
    }

    let targetTile = process.gameServer.world.getTileFromWorldPosition(targetPosition);

    if (targetTile === null) {
        return 0;
    }

    let target = targetTile.getCreature();

    if (target === null) {
        process.gameServer.world.sendMagicEffect(targetPosition, CONST.EFFECT.MAGIC.MORTAREA);
        return 20;
    }

    const CombatFormulas = requireModule("combat/combat-formulas");
    let damage = CombatFormulas.getMagicDamage(this, 0.18, 0, 0.52, 0);
    let result = CombatFormulas.calculateFinalDamage(this, target, CombatFormulas.COMBAT_TYPES.PHYSICAL, damage, 0);
    if (result.finalDamage !== 0) {
      target.decreaseHealth(this, Math.abs(result.finalDamage));
    }

    process.gameServer.world.sendMagicEffect(targetPosition, CONST.EFFECT.MAGIC.MORTAREA);

    return 20;

}
