"use strict";

const Outfit = function (outfit) {

  /*
   * Class Outfit
   * Container for a creature outfit (player, npc, monster)
   *
   * API:
   *
   * Outfit.getName(id) - returns the name that belongs to an outfit identifier
   *
   */

  // Identifier is required
  this.id = outfit.id !== undefined ? outfit.id : 1;

  // Mark as item looktype if ID is outside the outfit range
  this.isItem = this.id > 255;

  // Read the passed outfit details or set the default
  this.details = outfit.details ?? null;
  this.addonOne = outfit.addonOne ?? false;
  this.addonTwo = outfit.addonTwo ?? false;

}

Outfit.prototype.OUTFITS = require(getDataFile("outfits", "outfits"));

Outfit.prototype.getName = function (id) {

  /*
   * Function Outfit.getName
   * Returns the name of an outfit with a particular identifier
   */

  if (!this.OUTFITS.hasOwnProperty(id)) {
    return null;
  }


  return this.OUTFITS[id].name;

}

Outfit.prototype.toJSON = function () {

  /*
   * Function Outfit.toJSON
   * Serializes the outfit class to JSON to be stored in a database or file
   */

  return new Object({
    "id": this.id,
    "details": this.details,
    "addonOne": this.addonOne,
    "addonTwo": this.addonTwo
  });

}

Outfit.prototype.copy = function () {

  /*
   * Function Outfit.copy
   * Returns a memory copy of the outfit
   */

  return new Outfit(this.toJSON());

}

Outfit.prototype.isValid = function () {

  /*
   * Function Outfit.isValid
   * The outfit colors must be between 0 and 132
   */

  if (this.details === null) {
    return true;
  }

  // Must be within these ranges
  return this.details.head >= 0 && this.details.head < 133 &&
    this.details.body >= 0 && this.details.body < 133 &&
    this.details.legs >= 0 && this.details.legs < 133 &&
    this.details.feet >= 0 && this.details.feet < 133;

}

module.exports = Outfit;
