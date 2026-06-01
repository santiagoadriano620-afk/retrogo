"use strict";

const Position = requireModule("utils/position");
const Outfit = requireModule("entities/outfit");

const CharacterCreator = function () {

  /*
   * Class CharacterCreator
   * Handler for the creation of new characters
   */

  this.blueprint = new Object({
    "position": new Position(32097, 32219, 7),
    "templePosition": new Position(32097, 32219, 7),
    "properties": {
      "vocation": CONST.VOCATION.NONE,
      "role": CONST.ROLES.NONE,
      "sex": CONST.SEX.MALE,
      "maxCapacity": 2000,
      "availableOutfits": [],
      "name": "Unknown",
      "attack": 4,
      "attackSpeed": 40,
      "defense": 2,
      "direction": CONST.DIRECTION.SOUTH,
      "health": 150,
      "maxHealth": 150,
      "mana": 0,
      "maxMana": 0,
      "outfit": new Outfit({
        "id": 0,
        "details": {
          "head": 78,
          "body": 69,
          "legs": 58,
          "feet": 76
        },
        "addonOne": false,
        "addonTwo": false
      }),
      "speed": 220
    },
    "skills": {
      "experience": 0,
      "level": 1,
      "magic": 0,
      "fist": 0,
      "club": 0,
      "sword": 0,
      "axe": 0,
      "distance": 0,
      "shielding": 0,
      "fishing": 0
    },
    "spellbook": {
      "availableSpells": [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 70],
      "cooldowns": []
    },
    "containers": {
      "depot": [{"id": 2594}],
      "inbox": [],
      "equipment": [],
    },
    "friends": [],
    "storage": {}
  });

}

CharacterCreator.prototype.create = function (name, sex) {

  /*
   * CharacterCreator.create
   * Creates a new character with the given properties
   */

  // Memory copy of the template
  let copiedTemplate = JSON.parse(JSON.stringify(this.blueprint));

  // Replace the character name
  copiedTemplate.properties.name = name;

  // And sex specific attributes
  if (sex === "male") {
    copiedTemplate.properties.sex = CONST.SEX.MALE;
    copiedTemplate.properties.outfit.id = CONST.LOOKTYPES.MALE.CITIZEN;
    copiedTemplate.properties.availableOutfits = new Array(
      CONST.LOOKTYPES.MALE.CITIZEN,
      CONST.LOOKTYPES.MALE.HUNTER,
      CONST.LOOKTYPES.MALE.MAGE,
      CONST.LOOKTYPES.MALE.KNIGHT
    );
  } else if (sex === "female") {
    copiedTemplate.properties.sex = CONST.SEX.FEMALE;
    copiedTemplate.properties.outfit.id = CONST.LOOKTYPES.FEMALE.CITIZEN;
    copiedTemplate.properties.availableOutfits = new Array(
      CONST.LOOKTYPES.FEMALE.CITIZEN,
      CONST.LOOKTYPES.FEMALE.HUNTER,
      CONST.LOOKTYPES.FEMALE.MAGE,
      CONST.LOOKTYPES.FEMALE.KNIGHT
    );
  }

  // Admin character gets special vocation, default outfit 75, and all outfits available
  if (name === "Admin") {
    copiedTemplate.properties.vocation = CONST.VOCATION.ADMIN;
    copiedTemplate.properties.outfit.id = CONST.LOOKTYPES.OTHER.GAMEMASTER;
    copiedTemplate.properties.availableOutfits = new Array(
      CONST.LOOKTYPES.MALE.CITIZEN,
      CONST.LOOKTYPES.MALE.HUNTER,
      CONST.LOOKTYPES.MALE.MAGE,
      CONST.LOOKTYPES.MALE.KNIGHT,
      CONST.LOOKTYPES.MALE.NOBLEMAN,
      CONST.LOOKTYPES.MALE.SUMMONER,
      CONST.LOOKTYPES.MALE.WARRIOR,
      CONST.LOOKTYPES.FEMALE.CITIZEN,
      CONST.LOOKTYPES.FEMALE.HUNTER,
      CONST.LOOKTYPES.FEMALE.MAGE,
      CONST.LOOKTYPES.FEMALE.KNIGHT,
      CONST.LOOKTYPES.FEMALE.NOBLEMAN,
      CONST.LOOKTYPES.FEMALE.SUMMONER,
      CONST.LOOKTYPES.FEMALE.WARRIOR,
      CONST.LOOKTYPES.OTHER.ELF,
      CONST.LOOKTYPES.OTHER.DWARF
    );
  }

  // Return the template as a string to write it to the filesystem
  return JSON.stringify(copiedTemplate);

}


module.exports = CharacterCreator;
