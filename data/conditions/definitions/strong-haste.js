"use strict";

const { CreaturePropertyPacket } = requireModule("network/protocol");

function onStart(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("You feel very fast.");

  if (creature.isPlayer && creature.isPlayer()) {
    let newSpeed = creature.getSpeed();

    creature.broadcast(
      new CreaturePropertyPacket(creature.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
    creature.write(
      new CreaturePropertyPacket(creature.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
  }
}

function onExpire(creature) {
  if (creature.sendCancelMessage) creature.sendCancelMessage("Your speed returns to normal.");

  if (creature.isPlayer && creature.isPlayer()) {
    let newSpeed = creature.getSpeed();

    creature.broadcast(
      new CreaturePropertyPacket(creature.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
    creature.write(
      new CreaturePropertyPacket(creature.getId(), CONST.PROPERTIES.SPEED, newSpeed)
    );
  }
}

function onTick(creature) {
}

module.exports.onStart = onStart;
module.exports.onExpire = onExpire;
module.exports.onTick = onTick;
