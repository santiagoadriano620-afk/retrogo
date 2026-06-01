const CONJURE_RUNE_MAP = {
  // ad... prefix spells map to rune item IDs
  43: { item: 2287, charges: 5 },  // adori -> Light Magic Missile Rune
  44: { item: 2302, charges: 2 },  // adori flam -> Fireball Rune
  45: { item: 2304, charges: 2 },  // adori gran flam -> Great Fireball Rune
  46: { item: 2311, charges: 5 },  // adori gran -> Heavy Magic Missile Rune
  47: { item: 2268, charges: 1 },  // adori vita vis -> Sudden Death Rune
  48: { item: 2265, charges: 1 },  // adura gran -> Intense Healing Rune
  49: { item: 2273, charges: 1 },  // adura vita -> Ultimate Healing Rune
  50: { item: 2266, charges: 1 },  // adana pox -> Antidote Rune
  51: { item: 2278, charges: 1 },  // adana ani -> Paralyze Rune
  52: { item: 2316, charges: 1 },  // adana mort -> Animate Dead Rune
  53: { item: 2313, charges: 3 },  // adevo mas hur -> Explosion Rune
  54: { item: 2308, charges: 2 },  // adevo res flam -> Soulfire Rune
  55: { item: 2262, charges: 2 },  // adevo mas vis -> Energy Bomb Rune
  56: { item: 2277, charges: 3 },  // adevo grav vis -> Energy Field Rune
  57: { item: 2279, charges: 4 },  // adevo mas grav vis -> Energy Wall Rune
  58: { item: 2305, charges: 2 },  // adevo mas flam -> Firebomb Rune
  59: { item: 2301, charges: 3 },  // adevo grav flam -> Fire Field Rune
  60: { item: 2303, charges: 4 },  // adevo mas grav flam -> Fire Wall Rune
  61: { item: 2286, charges: 2 },  // adevo mas pox -> Poison Bomb Rune
  62: { item: 2285, charges: 3 },  // adevo grav pox -> Poison Field Rune
  63: { item: 2289, charges: 4 },  // adevo mas grav pox -> Poison Wall Rune
  64: { item: 2293, charges: 3 },  // adevo grav tera -> Magic Wall Rune
  65: { item: 2291, charges: 1 },  // adevo ina -> Chameleon Rune
  66: { item: 2292, charges: 1 },  // adevo res pox -> Envenom Rune
  67: { item: 2290, charges: 1 },  // adeta sio -> Convince Creature Rune
  68: { item: 2261, charges: 3 },  // adito grav -> Destroy Field Rune
  69: { item: 2310, charges: 3 },  // adito tera -> Desintegrate Rune
};

module.exports = function conjureRune() {
  let spellId = this.__castingSpellId;
  let info = CONJURE_RUNE_MAP[spellId];
  if (!info) {
    return 0;
  }

  let isGM = this.getProperty(CONST.PROPERTIES.ROLE) >= 3;

  if (!this.containerManager || !this.containerManager.equipment) {
    return 0;
  }

  if (!isGM && !this.containerManager.equipment.removeItem(2260, 1)) {
    this.sendCancelMessage("You need a blank rune.");
    return 0;
  }

  let item = gameServer.database.createThing(info.item);
  if (!item) {
    return 0;
  }

  item.setCount(info.charges);
  this.containerManager.pickupItem(item);

  process.gameServer.world.sendMagicEffect(this.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
  return 100;
}
