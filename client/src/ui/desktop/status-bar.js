const StatusBar = function () {

  /*
   * Class StatusBar
   * Container for the status bar that keeps active conditions
   */

  this.statusBarElement = document.getElementById("conditions-display");

}

// Map to look up conditions - IDs must match client/data/740/constants.json
StatusBar.prototype.STATUS = new Map();
StatusBar.prototype.STATUS.set(0, { "title": __("status.drunk"), "src": "/images/game/states/drunk.png" });
StatusBar.prototype.STATUS.set(1, { "title": __("status.poisoned"), "src": "/images/game/states/poisoned.png" });
StatusBar.prototype.STATUS.set(2, { "title": __("status.burning"), "src": "/images/game/states/burning.png" });
StatusBar.prototype.STATUS.set(3, { "title": __("status.electrified"), "src": "/images/game/states/electrified.png" });
StatusBar.prototype.STATUS.set(4, { "title": __("status.invisible"), "src": "/images/game/states/invisible.png" });
StatusBar.prototype.STATUS.set(5, { "title": "You are in a protection zone.", "src": "/images/game/states/protection_zone.png" });
// ID 6 = SUPPRESS_DRUNK (no visual), ID 7 = LIGHT (no visual)
StatusBar.prototype.STATUS.set(11, { "title": __("status.magic_shield"), "src": "/images/game/states/magic_shield.png" });
StatusBar.prototype.STATUS.set(18, { "title": __("status.paralyzed"), "src": "/images/game/states/slowed.png" });
StatusBar.prototype.STATUS.set(14, { "title": __("status.haste"), "src": "/images/game/states/haste.png" });
StatusBar.prototype.STATUS.set(17, { "title": "You are in combat. You may not logout for 60 seconds.", "src": "/images/game/states/logout_block.png" });

StatusBar.prototype.update = function () {

  if (!this.statusBarElement) return;

  let conditionNodes = Array.from(gameClient.player.conditions.__conditions).filter(function (cid) {
    return this.STATUS.has(cid);
  }, this).map(this.__createConditionNode, this);

  this.statusBarElement.replaceChildren(...conditionNodes);

}

StatusBar.prototype.__createConditionNode = function (cid) {

  /*
   * Function StatusBar.__createConditionNode
   * Creates a single status node for the status bar (cache?)
   */

  let { src, title } = this.STATUS.get(cid);

  let img = document.createElement("img");
  img.src = src;
  img.title = title;

  return img;

}

