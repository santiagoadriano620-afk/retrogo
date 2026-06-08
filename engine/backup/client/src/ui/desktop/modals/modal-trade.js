const TradeModal = function (id) {
  Modal.call(this, id);

  this.__requesterName = null;
  this.__myName = "";
  this.__opponentName = "";
  this.__myItems = [];
  this.__opponentItems = [];
  this.__myGold = 0;
  this.__opponentGold = 0;
  this.__myConfirmed = false;
  this.__opponentConfirmed = false;
  this.__active = false;

  this.__yourSlotsEl = document.getElementById("trade-your-slots");
  this.__opponentSlotsEl = document.getElementById("trade-opponent-slots");
  this.__yourGoldInput = document.getElementById("trade-your-gold");
  this.__opponentGoldEl = document.getElementById("trade-opponent-gold");
  this.__yourNameEl = document.getElementById("trade-your-name");
  this.__opponentNameEl = document.getElementById("trade-opponent-name");
  this.__yourCountEl = document.getElementById("trade-your-count");
  this.__opponentCountEl = document.getElementById("trade-opponent-count");
  this.__statusA = document.getElementById("trade-status-a");
  this.__statusB = document.getElementById("trade-status-b");
  this.__yourTotalGoldEl = document.getElementById("trade-your-total-gold");

  this.__yourGoldInput.addEventListener("change", this.__onGoldChange.bind(this));

  this.__countOverlay = document.getElementById("trade-count-overlay");
  this.__countSlider = document.getElementById("trade-count-slider");
  this.__countValue = document.getElementById("trade-count-value");
  this.__countSprite = document.getElementById("trade-count-sprite");
  this.__countContext = null;

  document.getElementById("trade-count-confirm").addEventListener("click", this.__onCountConfirm.bind(this));
  document.getElementById("trade-count-cancel").addEventListener("click", this.__onCountCancel.bind(this));
  this.__countSlider.addEventListener("input", this.__onCountChange.bind(this));
};

TradeModal.prototype = Object.create(Modal.prototype);
TradeModal.prototype.constructor = TradeModal;

TradeModal.prototype.getRequesterName = function () {
  return this.__requesterName;
};

TradeModal.prototype.showRequest = function (requesterName) {
  this.__requesterName = requesterName;
  gameClient.interface.setCancelMessage(__("modal.trade.wants_to_trade", requesterName));
};

TradeModal.prototype.handleOpen = function (data) {
  if (!data) return;
  this.__myName = data.playerName;
  this.__opponentName = data.opponentName;
  this.__myItems = [];
  this.__opponentItems = [];
  this.__myGold = 0;
  this.__opponentGold = 0;
  this.__myConfirmed = false;
  this.__opponentConfirmed = false;
  this.__active = true;

  this.__yourNameEl.textContent = this.__myName;
  this.__opponentNameEl.textContent = this.__opponentName;

  this.__render();
};

TradeModal.prototype.updateTrade = function (data) {
  if (gameClient.player && this.__myName === gameClient.player.getName()) {
    this.__opponentItems = data.opponentItems || [];
    this.__opponentGold = data.opponentGold || 0;
    this.__myItems = data.ownItems || [];
    this.__myGold = data.ownGold || 0;
  } else {
    this.__opponentItems = data.ownItems || [];
    this.__opponentGold = data.ownGold || 0;
    this.__myItems = data.opponentItems || [];
    this.__myGold = data.opponentGold || 0;
  }

  this.__myConfirmed = false;
  this.__opponentConfirmed = false;
  this.__render();
};

TradeModal.prototype.updateConfirm = function (data) {
  this.__myConfirmed = data.confirmedA;
  this.__opponentConfirmed = data.confirmedB;

  this.__statusA.className = "trade-status-dot" + (this.__myConfirmed ? " confirmed" : "");
  this.__statusB.className = "trade-status-dot" + (this.__opponentConfirmed ? " confirmed" : "");
};

TradeModal.prototype.tradeComplete = function () {
  this.__active = false;
  gameClient.interface.setCancelMessage(__("modal.trade.completed"));
  gameClient.interface.modalManager.close();
};

TradeModal.prototype.tradeCancelled = function (reason) {
  this.__active = false;
  this.__myConfirmed = false;
  this.__opponentConfirmed = false;
  gameClient.interface.setCancelMessage(reason);
  gameClient.interface.modalManager.close();
};

TradeModal.prototype.__getPlayerTotalGold = function () {
  if (!gameClient.player) return 0;
  let total = 0;
  gameClient.player.equipment.slots.forEach(function (slot) {
    if (slot.item && slot.item.id === 2148) {
      total += slot.item.count || 1;
    }
  });
  gameClient.player.__openedContainers.forEach(function (container) {
    container.slots.forEach(function (slot) {
      if (slot.item && slot.item.id === 2148) {
        total += slot.item.count || 1;
      }
    });
  });
  return total;
};

TradeModal.prototype.__render = function () {
  this.__renderSlots(this.__yourSlotsEl, this.__myItems, true);
  this.__renderSlots(this.__opponentSlotsEl, this.__opponentItems, false);
  this.__yourGoldInput.value = this.__myGold;
  this.__opponentGoldEl.textContent = String(this.__opponentGold);
  this.__yourCountEl.textContent = String(this.__myItems.length);
  this.__opponentCountEl.textContent = String(this.__opponentItems.length);
  if (this.__yourTotalGoldEl) {
    this.__yourTotalGoldEl.textContent = String(this.__getPlayerTotalGold());
  }

  this.__statusA.className = "trade-status-dot" + (this.__myConfirmed ? " confirmed" : "");
  this.__statusB.className = "trade-status-dot" + (this.__opponentConfirmed ? " confirmed" : "");
};

TradeModal.prototype.__renderSlots = function (container, items, isOwn) {
  container.innerHTML = "";
  for (let i = 0; i < 20; i++) {
    let slot = document.createElement("div");
    slot.className = "trade-slot";
    slot.setAttribute("data-trade-slot-index", String(i));
    if (i < items.length) {
      let entry = items[i];
      slot.className = "trade-slot has-item";

      if (isOwn) {
        slot.addEventListener("click", this.__onRemoveItem.bind(this, i));
      }

      let item = new Item(entry.itemId, entry.count || 1);
      let frameGroup = item.getFrameGroup(FrameGroup.prototype.NONE);
      if (frameGroup) {
        let frame = item.getFrame();
        let pattern = item.getPattern();
        let spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
        let sprite = frameGroup.getSprite(spriteIndex);
        if (sprite && sprite.src) {
          let canvas = document.createElement("canvas");
          canvas.width = 32;
          canvas.height = 32;
          let ctx = canvas.getContext("2d");
          ctx.drawImage(
            sprite.src,
            32 * sprite.position.x, 32 * sprite.position.y, 32, 32,
            0, 0, 32, 32
          );
          let img = document.createElement("img");
          img.src = canvas.toDataURL();
          img.style.width = "32px";
          img.style.height = "32px";
          img.style.imageRendering = "pixelated";
          slot.appendChild(img);
        }
      }

      if (entry.count > 1) {
        let countEl = document.createElement("span");
        countEl.className = "trade-slot-count";
        countEl.textContent = String(entry.count);
        slot.appendChild(countEl);
      }
    }
    container.appendChild(slot);
  }
};

TradeModal.prototype.__onGoldChange = function () {
  if (!this.__active) return;
  let val = parseInt(this.__yourGoldInput.value, 10);
  if (isNaN(val) || val < 0) val = 0;
  this.__yourGoldInput.value = String(val);
  gameClient.send(new TradeSetGoldPacketClient(val));
};

TradeModal.prototype.__onRemoveItem = function (slotIndex) {
  if (!this.__active) return;
  gameClient.send(new TradeRemoveItemPacketClient(slotIndex));
};

TradeModal.prototype.__showCountSelector = function (containerId, slotIndex, maxCount, itemId) {
  this.__countContext = { containerId: containerId, slotIndex: slotIndex };
  this.__countSlider.max = String(maxCount);
  this.__countSlider.value = String(maxCount);
  this.__countValue.textContent = String(maxCount);
  this.__drawCountSprite(itemId, maxCount);
  this.__countOverlay.style.display = "flex";
};

TradeModal.prototype.__drawCountSprite = function (itemId, count) {
  let canvas = new Canvas(this.__countSprite, 32, 32);
  canvas.clear();
  let item = new Item(itemId, count);
  canvas.drawSprite(item, new Position(0, 0), 32);
};

TradeModal.prototype.__onCountChange = function () {
  this.__countValue.textContent = this.__countSlider.value;
};

TradeModal.prototype.__onCountConfirm = function () {
  if (!this.__countContext) return;
  gameClient.send(new TradeAddItemPacketClient(
    this.__countContext.containerId,
    this.__countContext.slotIndex,
    Number(this.__countSlider.value)
  ));
  this.__countContext = null;
  this.__countOverlay.style.display = "none";
};

TradeModal.prototype.__onCountCancel = function () {
  this.__countContext = null;
  this.__countOverlay.style.display = "none";
};

TradeModal.prototype.handleConfirm = function () {
  if (!this.__active) {
    return true;
  }
  gameClient.send(new TradeConfirmPacketClient());
  return false;
};

TradeModal.prototype.handleCancel = function () {
  if (this.__active) {
    gameClient.send(new TradeRejectPacketClient());
  }
  this.__active = false;
  return true;
};
