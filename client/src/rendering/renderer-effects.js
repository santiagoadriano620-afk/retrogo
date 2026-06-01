Renderer.prototype.__renderDistanceAnimation = function (animation, thing) {

  if (animation.expired()) {
    thing.delete(animation);
  }

  let position = this.getStaticScreenPosition(animation.getPosition());
  
  if (position.x < -1 || position.x > 29 || position.y < -1 || position.y > 16) {
    return;
  }

  this.screen.drawDistanceAnimation(animation, position);

}

Renderer.prototype.__renderAnimation = function (animation, thing) {

  if (animation.expired()) {
    thing.deleteAnimation(animation);
  }

  if (thing instanceof Tile) {
    let screenPos = this.getStaticScreenPosition(thing.getPosition());
    
    if (screenPos.x < -2 || screenPos.x > 32 || screenPos.y < -2 || screenPos.y > 18) {
      return;
    }
    
    let player = gameClient.player;
    let pp = player.getPosition();
    let tp = thing.getPosition();
    let distX = Math.abs((tp.x) - (pp.x));
    let distY = Math.abs((tp.y) - (pp.y));
    let maxDist = Math.max(distX, distY);
    
    if (maxDist > 14) {
      return;
    }
  }

  if (animation instanceof BoxAnimation) {
    let pos = this.getCreatureScreenPosition(thing);
    this.__combatRects.push({ inner: true, x: pos.x, y: pos.y, color: animation.color });
  } else if (thing instanceof Tile) {
    let pos = this.getStaticScreenPosition(thing.getPosition());
    pos.x -= thing.__renderElevation;
    pos.y -= thing.__renderElevation;
    this.screen.drawSprite(animation, pos, 32);
  } else if (thing instanceof Creature) {
    this.screen.drawSprite(animation, this.getCreatureScreenPosition(thing), 32);
  }

  this.screen.setGlobalAlpha(1);

}

Renderer.prototype.__renderTileAnimations = function (tile) {

  for (let animation of tile.__animations) {
    this.__renderAnimation(animation, tile);
  }

}
