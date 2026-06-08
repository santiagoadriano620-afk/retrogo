const FluidThing = function(id, count) {

  /*
   * Class FluidThing
   * Container for fluid containers (e.g., troughs and vials) but also splashes (e.g., blood)
   */

  // Inherits from item with a count that represents the fluid type
  Item.call(this, id, count);

}

FluidThing.prototype = Object.create(Item.prototype);
FluidThing.prototype.constructor = FluidThing;

FluidThing.prototype.FLUID_TYPES = new Object({
  "NONE": 0,
  "WATER": 1,
  "WINE": 2,
  "BEER": 3,
  "MUD": 4,
  "BLOOD": 5,
  "SLIME": 6,
  "OIL": 7,
  "URINE": 8,
  "MILK": 9,
  "MANA": 10,
  "HEALTH": 11,
  "LEMONADE": 12,
  "LAVA": 26,
  "RUM": 27
});

FluidThing.prototype.FLUID_COLORS = new Object({
  "TRANSPARENT": 0,
  "BLUE": 1,
  "RED": 2,
  "BROWN": 3,
  "GREEN": 4,
  "YELLOW": 5,
  "WHITE": 6,
  "PURPLE": 7
});

FluidThing.prototype.getPattern = function(pattern) {

  /*
   * Function FluidThing.getPattern
   * Returns the pattern for the liquid item
   */

  let frameGroup = this.getFrameGroup(FrameGroup.prototype.NONE);

  // Map it to the correct sprite index
  let index = this.__getLiquidPatternIndex();

  let x = (index % 4) % frameGroup.pattern.x;
  let y = Math.floor(index / 4) % frameGroup.pattern.y;

  // Return the pattern
  return new Position(x, y, 0);

}

FluidThing.prototype.__getLiquidPatternIndex = function() {

  /*
   * Function FluidThing.__getLiquidPatternIndex
   * Returns the index of the liquid pattern
   */

  // Count represents the type of the liquid
  switch(this.count) {
    case this.FLUID_TYPES.NONE:
      return this.FLUID_COLORS.TRANSPARENT;
    case this.FLUID_TYPES.WATER:
      return this.FLUID_COLORS.BLUE;
    case this.FLUID_TYPES.MANA:
      return this.FLUID_COLORS.PURPLE;
    case this.FLUID_TYPES.BEER:
    case this.FLUID_TYPES.WINE:
    case this.FLUID_TYPES.RUM:
      return this.FLUID_COLORS.PURPLE;
    case this.FLUID_TYPES.OIL:
    case this.FLUID_TYPES.MUD:
      return this.FLUID_COLORS.BROWN;
    case this.FLUID_TYPES.BLOOD:
    case this.FLUID_TYPES.HEALTH:
    case this.FLUID_TYPES.LAVA:
      return this.FLUID_COLORS.RED;
    case this.FLUID_TYPES.SLIME:
      return this.FLUID_COLORS.GREEN;
    case this.FLUID_TYPES.LEMONADE:
    case this.FLUID_TYPES.URINE:
      return this.FLUID_COLORS.YELLOW;
    case this.FLUID_TYPES.MILK:
      return this.FLUID_COLORS.WHITE;
    default:
      return this.FLUID_COLORS.TRANSPARENT;
  }
  
}
