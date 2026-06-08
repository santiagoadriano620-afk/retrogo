Renderer.prototype.__renderLightThing = function (position, thing, intensity) {

  let info = thing.getDataObject().properties.light;
  if (!info) return;

  let size = Math.max(0.5, info.level * 0.75);

  this.lightscreen.renderLightBubble(
    position.x,
    position.y,
    size,
    210,
    info.level
  );

}

Renderer.prototype.__renderLight = function (tile, position, thing, intensity) {

  let chunk = gameClient.world.getChunkFromWorldPosition(tile.getPosition());

  if (chunk === null) {
    return;
  }

  let floor = chunk.getFirstFloorFromBottomProjected(tile.getPosition());

  if (floor === null || floor >= gameClient.player.getMaxFloor()) {
    this.__renderLightThing(position, thing, intensity);
  }

}
