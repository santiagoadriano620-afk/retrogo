function onStart(creature) {
  if (creature.sendCancelMessage) {
    creature.sendCancelMessage("You are paralyzed!");
  }
}

function onTick(creature) {}

function onExpire(creature) {
  if (creature.sendCancelMessage) {
    creature.sendCancelMessage("You are no longer paralyzed.");
  }
}

module.exports = { onStart, onTick, onExpire };
