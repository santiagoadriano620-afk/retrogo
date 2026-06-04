const OutfitModal = function(id) {
  Modal.call(this, id);
  this.__addEventListeners();
  this.__activeOutfitElement = null;
  this.__spriteBuffer = new SpriteBuffer(2);
  this.__canvas = new Canvas(document.getElementById("outfit-example"), 64, 64);
  this.__outfit = null;
  this.__outfitIndex = 0;
}

OutfitModal.prototype = Object.create(Modal.prototype);
OutfitModal.constructor = OutfitModal;

OutfitModal.prototype.handleOpen = function(options) {
  this.__outfit = gameClient.player.outfit.copy();
  this.__internalToggleSectionSelect(document.getElementById("outfit-head"));
  this.__outfitIndex = this.__getIndex(gameClient.player.outfits, this.__outfit.id);
  let outfitData = gameClient.player.outfits[this.__outfitIndex];
  if (outfitData) this.__outfit.premium = outfitData.premium;
  this.__renderOutfit();
}

OutfitModal.prototype.handleConfirm = function() {
  if (this.__outfit.premium && !gameClient.player.isPremium) {
    gameClient.interface.setCancelMessage("This outfit is only available to premium players.");
    return false;
  }
  if (!gameClient.player.outfit.equals(this.__outfit)) {
    gameClient.send(new OutfitChangePacket(this.__outfit));
  }
  return true;
}

OutfitModal.prototype.handleRender = function() {
}

OutfitModal.prototype.__addEventListeners = function() {
  let colorElementWrapper = this.element.querySelector(".outfit-color-picker");
  colorElementWrapper.addEventListener("click", this.__handleChangeOutfitColor.bind(this));
  Array.from(this.element.getElementsByClassName("outfit-face-picker")).forEach(function(element) {
    element.addEventListener("click", this.__toggleSectionSelect.bind(this));
  }, this);
  document.getElementById("next-outfit").addEventListener("click", this.__handleSelectOutfit.bind(this, 1));
}

OutfitModal.prototype.__getIndex = function(input, id) {
  for (let i = 0; i < input.length; i++) {
    if (input[i].id === id) return i;
  }
  return 0;
}

OutfitModal.prototype.__handleSelectOutfit = function(value) {
  this.__outfitIndex += value;
  this.__outfitIndex = ((this.__outfitIndex % gameClient.player.outfits.length) + gameClient.player.outfits.length) % gameClient.player.outfits.length;
  let outfitData = gameClient.player.outfits[this.__outfitIndex];
  this.__outfit.id = outfitData.id;
  this.__outfit.premium = outfitData.premium;
  this.__renderOutfit();
}

OutfitModal.prototype.__toggleSectionSelect = function(event) {
  this.__internalToggleSectionSelect(event.target);
}

OutfitModal.prototype.__internalToggleSectionSelect = function(target) {
  if (this.__activeOutfitElement !== null) {
    this.__activeOutfitElement.classList.remove("on");
  }
  target.classList.add("on");
  this.__activeOutfitElement = target;
}

OutfitModal.prototype.__setOutfitDetail = function(id, index) {
  switch (id) {
    case "outfit-head": this.__outfit.details.head = index; break;
    case "outfit-body": this.__outfit.details.body = index; break;
    case "outfit-legs": this.__outfit.details.legs = index; break;
    case "outfit-feet": this.__outfit.details.feet = index; break;
  }
  this.__renderOutfit();
}

OutfitModal.prototype.__handleChangeOutfitColor = function(event) {
  if (this.__activeOutfitElement === null) return;
  let index = event.target.getAttribute("index");
  if (index === null) return;
  this.__setOutfitDetail(this.__activeOutfitElement.id, Number(index));
}

OutfitModal.prototype.__renderOutfit = function() {
  let outfitObject = this.__outfit.getDataObject();
  if (outfitObject === null) return;
  let item = outfitObject.getFrameGroup(0);
  this.__canvas.clear();
  this.__spriteBuffer.clear();
  this.__canvas.__drawCharacter(
    this.__spriteBuffer,
    this.__outfit,
    new Position(0.5, 0.5),
    item,
    0,
    2,
    0,
    32,
    0
  );
  let nameEl = document.getElementById("outfit-name");
  let outfitInfo = gameClient.player.outfits[this.__outfitIndex];
  if (outfitInfo) {
    let isLocked = outfitInfo.premium && !gameClient.player.isPremium;
    nameEl.textContent = outfitInfo.name + (isLocked ? " (PREMIUM)" : "");
    nameEl.className = "outfit-name-label" + (isLocked ? " premium-locked" : "");
  }
}
