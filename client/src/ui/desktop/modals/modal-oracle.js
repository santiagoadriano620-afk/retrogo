const OracleModal = function(id) {
  Modal.call(this, id);
  this.__npcId = null;
  this.__vocations = [];
  this.__towns = [];
  this.__selectedVocation = -1;
  this.__selectedTown = -1;
  this.__vocationCanvases = [];
  this.__vocationBuffers = [];
}

OracleModal.DESCRIPTIONS = {
  "Knight": "Expert in close combat. Specializes in melee weapons and heavy armor.",
  "Paladin": "Master of ranged combat. Uses distance weapons and light magic.",
  "Sorcerer": "Wielder of destructive magic. Excels at dealing massive elemental damage.",
  "Druid": "Master of healing arts. Restores allies and harnesses natural magic."
}

OracleModal.prototype = Object.create(Modal.prototype);
OracleModal.constructor = OracleModal;

OracleModal.prototype.handleOpen = function(properties) {
  this.__npcId = properties.npcId;
  this.__vocations = properties.vocations;
  this.__towns = properties.towns;
  this.__selectedVocation = -1;
  this.__selectedTown = -1;

  this.setTitle("Choose Your Destiny");
  this.__renderVocations();
  this.__renderTowns();
}

OracleModal.prototype.handleConfirm = function() {
  if (this.__selectedVocation === -1 || this.__selectedTown === -1) return false;
  gameClient.send(new OracleSelectionPacket(this.__npcId, this.__vocations[this.__selectedVocation].id, this.__towns[this.__selectedTown].id));
  return true;
}

OracleModal.prototype.handleCancel = function() {
  return true;
}

OracleModal.prototype.__renderVocations = function() {
  let container = document.getElementById("oracle-vocations");
  container.innerHTML = "";

  this.__vocations.forEach(function(v, i) {
    let card = document.createElement("div");
    card.className = "oracle-vocation-card";
    card.setAttribute("data-index", i);

    let canvasId = "oracle-outfit-" + i;
    let c = document.createElement("canvas");
    c.id = canvasId;
    c.width = 64;
    c.height = 64;
    card.appendChild(c);

    let nameEl = document.createElement("div");
    nameEl.className = "oracle-vocation-name";
    nameEl.textContent = v.name;
    card.appendChild(nameEl);

    let descEl = document.createElement("div");
    descEl.className = "oracle-vocation-desc";
    descEl.textContent = OracleModal.DESCRIPTIONS[v.name] || "";
    card.appendChild(descEl);

    card.addEventListener("click", this.__onVocationClick.bind(this, i));
    container.appendChild(card);

    let ctx = c.getContext("2d");
    let outfit = gameClient.player.outfit.copy();
    let outfitData = outfit.getDataObject();
    if (outfitData) {
      let item = outfitData.getFrameGroup(0);
      let totalW = item.width * 32;
      let totalH = item.height * 32;
      let startX = Math.round((64 - totalW) / 2);
      let startY = Math.round((64 - totalH) / 2);
      let sb = new SpriteBuffer(2);
      for (let ty = 0; ty < item.height; ty++) {
        for (let tx = 0; tx < item.width; tx++) {
          let sid = item.getSpriteId(0, 2, 0, 0, 0, tx, ty);
          if (sid !== 0) {
            sb.addComposedOutfit(sid, outfit, item, 0, 2, 0, tx, ty);
            let sprite = sb.get(sid);
            if (sprite) {
              ctx.drawImage(
                sprite.src,
                32 * sprite.position.x,
                32 * sprite.position.y,
                32, 32,
                startX + tx * 32,
                startY + ty * 32,
                32, 32
              );
            }
          }
        }
      }
    }
  }, this);
}

OracleModal.prototype.__renderTowns = function() {
  let container = document.getElementById("oracle-towns");
  container.innerHTML = "";

  this.__towns.forEach(function(t, i) {
    let btn = document.createElement("button");
    btn.className = "oracle-town-btn";
    btn.textContent = t.name;
    btn.setAttribute("data-index", i);
    btn.addEventListener("click", this.__onTownClick.bind(this, i));
    container.appendChild(btn);
  }, this);
}

OracleModal.prototype.__onVocationClick = function(index) {
  let cards = document.querySelectorAll("#oracle-vocations .oracle-vocation-card");
  cards.forEach(function(c, i) {
    c.classList.toggle("oracle-selected", i === index);
  });
  this.__selectedVocation = index;
}

OracleModal.prototype.__onTownClick = function(index) {
  let btns = document.querySelectorAll("#oracle-towns .oracle-town-btn");
  btns.forEach(function(b, i) {
    b.classList.toggle("oracle-selected", i === index);
  });
  this.__selectedTown = index;
}
