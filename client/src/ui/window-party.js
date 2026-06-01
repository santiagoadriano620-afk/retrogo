"use strict";

const PartyWindow = function (element) {

  InteractiveWindow.call(this, element);
  this.__spriteBuffer = new SpriteBuffer(2);

}

PartyWindow.prototype = Object.create(InteractiveWindow.prototype);
PartyWindow.prototype.constructor = PartyWindow;

PartyWindow.prototype.sync = function () {

  try {

    if (!gameClient.player) {
      this.close();
      return;
    }

    let members = gameClient.player.__partyMembers;
    if (!members || members.length === 0) {
      this.close();
      return;
    }

    if (this.isHidden()) this.open();

    let body = this.getBody();

    // Remove entries for members no longer in the party
    Array.from(body.children).forEach(function (el) {
      let mid = Number(el.getAttribute("data-member-id"));
      let stillExists = members.some(function (m) { return m.id === mid; });
      if (!stillExists) {
        el.remove();
      }
    });

    // Update or create entries
    members.forEach(function (member) {
      let el = body.querySelector('[data-member-id="%s"]'.format(member.id));
      if (!el) {
        el = this.__createEntry(member);
        if (el) body.appendChild(el);
      }
      if (el) this.__updateEntry(el, member);
    }, this);

  } catch (e) {
    console.warn("PartyWindow.sync error:", e);
  }

}

PartyWindow.prototype.__createEntry = function (member) {

  let node = document.getElementById("party-window-target").cloneNode(true);
  node.style.display = "flex";
  node.setAttribute("data-member-id", member.id);

  let cvs = node.querySelector(".party-window-target-canvas canvas");
  if (!cvs) return null;

  let canvas = new Canvas(cvs, 64, 64);
  node.__partyCanvas = canvas;

  this.__renderPortrait(canvas, member);
  node.querySelector(".party-window-target-title").innerHTML = member.name;

  return node;

}

PartyWindow.prototype.__updateEntry = function (el, member) {

  let hpPercent = Math.min(100, Math.max(0, member.healthPercent));
  let hpBar = el.querySelector(".health");
  if (hpBar) hpBar.style.width = hpPercent + "%";

  let titleEl = el.querySelector(".party-window-target-title");
  if (titleEl) titleEl.innerHTML = member.name;

  // Re-render portrait every frame (outfit if nearby, placeholder otherwise)
  if (el.__partyCanvas) {
    let creature = gameClient.world.getCreature(member.id);
    this.__renderPortrait(el.__partyCanvas, member, creature);
  }

}

PartyWindow.prototype.__renderPortrait = function (canvas, member, creature) {

  if (!canvas || !canvas.context) return;

  let ctx = canvas.context;

  // Draw vocation-colored background
  let hue = (member.id * 37) % 360;
  ctx.fillStyle = "hsl(" + hue + ", 60%, 30%)";
  ctx.fillRect(0, 0, 64, 64);

  // Pick the outfit: use creature.outfit if nearby, otherwise member.outfit from party data
  let outfit = null;
  if (creature && creature.outfit) {
    outfit = creature.outfit;
  } else if (member.outfit) {
    outfit = member.outfit;
  }

  if (outfit) {
    try {
      let outfitObject = outfit.getDataObject();
      if (outfitObject) {
        let item = outfitObject.getFrameGroup(0);
        if (item) {
          let totalW = item.width * 32;
          let totalH = item.height * 32;
          let startX = Math.round((64 - totalW) / 2);
          let startY = Math.round((64 - totalH) / 2);

          this.__spriteBuffer.clear();

          for (let ty = 0; ty < item.height; ty++) {
            for (let tx = 0; tx < item.width; tx++) {
              let sid = item.getSpriteId(0, 2, 0, 0, 0, tx, ty);
              if (sid !== 0) {
                this.__spriteBuffer.addComposedOutfit(sid, outfit, item, 0, 2, 0, tx, ty);
                let sprite = this.__spriteBuffer.get(sid);
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

          return;
        }
      }
    } catch (e) {
      console.warn("PartyWindow outfit draw error:", e);
    }
  }

  // Final fallback: draw the initial letter
  let letter = (member.name || "?").charAt(0).toUpperCase();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 32, 32);

}

