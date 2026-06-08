const OfferModal = function (element) {
  Modal.call(this, element);

  this.__selectedElement = null;
  this.__selectedOffer = null;
  this.__selectedQuantity = 1;
  this.__offerType = "buy";
  this.__offers = null;
  this.__npcId = null;

  this.__qtyPendingCard = null;
  this.__qtyPendingIndex = null;
  this.__qtyPendingOffer = null;

  document.getElementById("set-buy").addEventListener("click", this.setOfferType.bind(this, "buy"));
  document.getElementById("set-sell").addEventListener("click", this.setOfferType.bind(this, "sell"));
  document.getElementById("trade-search").addEventListener("input", this.__handleSearch.bind(this));

  document.getElementById("trade-qty-minus").addEventListener("click", function (e) {
    e.stopPropagation();
    this.__qtyChange(-1);
  }.bind(this));
  document.getElementById("trade-qty-plus").addEventListener("click", function (e) {
    e.stopPropagation();
    this.__qtyChange(1);
  }.bind(this));
  document.getElementById("trade-qty-confirm").addEventListener("click", function (e) {
    e.stopPropagation();
    this.__confirmQuantity();
  }.bind(this));
  document.getElementById("trade-qty-cancel").addEventListener("click", function (e) {
    e.stopPropagation();
    this.__cancelQuantity();
  }.bind(this));
}

OfferModal.prototype = Object.create(Modal.prototype);
OfferModal.constructor = OfferModal;

OfferModal.prototype.__handleSearch = function () {
  this.setOffers();
}

OfferModal.prototype.setOfferType = function (which) {
  document.getElementById("set-buy").className = "btn-botao";
  document.getElementById("set-sell").className = "btn-botao";
  document.getElementById("set-%s".format(which)).className += " selected";

  if (this.__offerType === which) return;

  this.__offerType = which;
  this.__selectedElement = null;
  this.__selectedOffer = null;
  this.__selectedQuantity = 1;
  this.setOffers();
}

OfferModal.prototype.__filterType = function () {
  return this.__offerType === "buy" ? "sell" : "buy";
}

OfferModal.prototype.setOffers = function () {
  this.clear();

  let offerDOM = document.getElementById("offers");
  offerDOM.innerHTML = "";

  let query = document.getElementById("trade-search").value.toLowerCase();

  let filteredOffers = [];
  this.__offers.forEach(function (offer, originalIndex) {
    if (offer.type === this.__filterType() && offer.name.toLowerCase().includes(query)) {
      filteredOffers.push({ offer: offer, originalIndex: originalIndex });
    }
  }, this);

  if (filteredOffers.length === 0) {
    return offerDOM.innerHTML = __("modal.offer.no_offers", this.__offerType);
  }

  filteredOffers.map(function (item) {
    return this.createOfferNode(item.offer, item.originalIndex);
  }, this).forEach(function (node) {
    offerDOM.appendChild(node);
  });
}

OfferModal.prototype.createOfferNode = function (offer, index) {
  let card = document.createElement("div");
  card.className = "trade-item-card";
  card.dataset.index = index;

  let item;
  let thing = new Thing(offer.id, offer.count || 0);
  if (thing.isFluidContainer() || thing.isSplash()) {
    item = new FluidThing(offer.id, offer.count || 0);
  } else {
    item = new Item(offer.id, offer.count || 0);
  }

  let canSell = this.__owned[index] > 0;
  if (this.__offerType === "sell" && !canSell) {
    card.classList.add("not-owned");
  }

  let iconCanvas = new Canvas(null, 32, 32);
  iconCanvas.canvas.className = "item-icon";
  iconCanvas.drawSprite(item, Position.prototype.NULL, 32);
  card.appendChild(iconCanvas.canvas);

  let nameEl = document.createElement("div");
  nameEl.className = "item-card-name";
  nameEl.textContent = offer.name;
  card.appendChild(nameEl);

  let priceEl = document.createElement("div");
  priceEl.className = "item-card-price";
  priceEl.textContent = offer.price + " gp";
  card.appendChild(priceEl);

  if (offer.weight > 0) {
    let weightEl = document.createElement("div");
    weightEl.className = "item-card-weight";
    weightEl.textContent = (offer.weight / 100).toFixed(2) + " oz";
    card.appendChild(weightEl);
  }

  let qtyEl = document.createElement("div");
  qtyEl.className = "item-card-qty-selected";
  card.appendChild(qtyEl);

  card.addEventListener("click", this.handleSelectOffer.bind(this, card, offer, index));

  return card;
}

OfferModal.prototype.__getMaxQuantity = function (offer) {
  if (!offer) return 1;

  if (this.__offerType === "buy") {
    let player = gameClient.player;
    let cap = player && player.state ? player.state.capacity : 0;
    let maxByCap = offer.weight > 0 ? Math.floor(cap * 100 / offer.weight) : 100;
    return Math.min(maxByCap, 100);
  } else {
    return Math.min(this.__owned[this.__offers.indexOf(offer)] || 0, 100);
  }
}

OfferModal.prototype.__canBuyQuantity = function (offer) {
  let dataObj = gameClient.dataObjects.get(offer.id);
  if (!dataObj) return false;
  if (dataObj.flags.get(PropBitFlag.prototype.flags.DatFlagStackable)) return true;
  if (dataObj.flags.get(PropBitFlag.prototype.flags.DatFlagFluidContainer)) return true;
  if (offer.id === 2260) return true;
  return false;
}

OfferModal.prototype.clear = function () {
  this.__hideQuantityOverlay();

  if (this.__selectedElement !== null) {
    this.__selectedElement.classList.remove("selected");
    let qtyDisplay = this.__selectedElement.querySelector(".item-card-qty-selected");
    if (qtyDisplay) qtyDisplay.textContent = "";
  }
  this.__selectedElement = null;
  this.__selectedOffer = null;
  this.__selectedQuantity = 1;
  this.__updateSelectedInfo(null, 0);
}

OfferModal.prototype.handleSelectOffer = function (card, offer, index) {
  let canQty = this.__canBuyQuantity(offer);
  let maxQty = this.__getMaxQuantity(offer);

  if (canQty && (this.__offerType === "buy" || maxQty > 1)) {
    this.__showQuantityOverlay(card, offer, index);
    return;
  }

  if (this.__selectedElement !== null) {
    this.__selectedElement.classList.remove("selected");
    let prevQty = this.__selectedElement.querySelector(".item-card-qty-selected");
    if (prevQty) prevQty.textContent = "";
  }

  this.__selectedElement = card;
  this.__selectedOffer = index;
  this.__selectedQuantity = 1;
  card.classList.add("selected");

  let qtyDisplay = card.querySelector(".item-card-qty-selected");
  if (qtyDisplay) qtyDisplay.textContent = "1x";

  this.__updateSelectedInfo(offer, 1);
}

OfferModal.prototype.__updateSelectedInfo = function (offer, qty) {
  if (!offer) {
    document.getElementById("trade-selected-info").textContent = "";
    return;
  }
  let label = this.__offerType === "buy" ? __("modal.offer.buy") : __("modal.offer.sell");
  let total = offer.price * qty;
  document.getElementById("trade-selected-info").textContent = __("modal.offer.selected_info", label, qty, offer.name, total);
}

OfferModal.prototype.__showQuantityOverlay = function (card, offer, index) {
  this.__qtyPendingCard = card;
  this.__qtyPendingIndex = index;
  this.__qtyPendingOffer = offer;
  let max = this.__getMaxQuantity(offer);
  this.__qtyTempQuantity = 1;

  let item;
  let thing = new Thing(offer.id, offer.count || 0);
  if (thing.isFluidContainer() || thing.isSplash()) {
    item = new FluidThing(offer.id, offer.count || 0);
  } else {
    item = new Item(offer.id, offer.count || 0);
  }

  let iconCanvas = new Canvas(null, 32, 32);
  iconCanvas.drawSprite(item, Position.prototype.NULL, 32);
  let qtyIcon = document.getElementById("trade-qty-icon");
  let ctx = qtyIcon.getContext("2d");
  ctx.clearRect(0, 0, 32, 32);
  ctx.drawImage(iconCanvas.canvas, 0, 0);

  document.getElementById("trade-qty-name").textContent = offer.name;
  document.getElementById("trade-qty-value").textContent = this.__qtyTempQuantity;
  document.getElementById("trade-qty-max").textContent = __("modal.offer.max", max);
  document.getElementById("trade-qty-overlay").style.display = "flex";
}

OfferModal.prototype.__hideQuantityOverlay = function () {
  document.getElementById("trade-qty-overlay").style.display = "none";
  this.__qtyPendingCard = null;
  this.__qtyPendingIndex = null;
  this.__qtyPendingOffer = null;
}

OfferModal.prototype.__qtyChange = function (delta) {
  if (this.__qtyPendingOffer === null) return;
  let newQty = this.__qtyTempQuantity + delta;
  if (newQty < 1) newQty = 1;
  let max = this.__getMaxQuantity(this.__qtyPendingOffer);
  document.getElementById("trade-qty-max").textContent = __("modal.offer.max", max);
  if (newQty > max) newQty = max;
  this.__qtyTempQuantity = newQty;
  document.getElementById("trade-qty-value").textContent = newQty;
}

OfferModal.prototype.__confirmQuantity = function () {
  if (this.__qtyPendingCard === null) return;

  let max = this.__getMaxQuantity(this.__qtyPendingOffer);
  let qty = this.__qtyTempQuantity;
  if (qty < 1) qty = 1;
  if (max > 0 && qty > max) qty = max;

  if (this.__selectedElement !== null) {
    this.__selectedElement.classList.remove("selected");
  }

  this.__selectedElement = this.__qtyPendingCard;
  this.__selectedOffer = this.__qtyPendingIndex;
  this.__selectedQuantity = qty;
  this.__qtyPendingCard.classList.add("selected");

  let qtyDisplay = this.__qtyPendingCard.querySelector(".item-card-qty-selected");
  if (qtyDisplay) {
    qtyDisplay.textContent = qty + "x";
  }

  this.__updateSelectedInfo(this.__qtyPendingOffer, qty);
  this.__hideQuantityOverlay();
}

OfferModal.prototype.__cancelQuantity = function () {
  this.__hideQuantityOverlay();
}

OfferModal.prototype.__getCoinValue = function (item) {
  if (!item || typeof item.id !== "number") return 0;
  if (item.id === 2148) return (item.count || 1) * 1;
  if (item.id === 2152) return (item.count || 1) * 100;
  if (item.id === 2160) return (item.count || 1) * 10000;
  return 0;
}

OfferModal.prototype.__countGoldRecursive = function (container) {
  let total = 0;
  if (!container || !container.slots) return 0;
  for (let s = 0; s < container.slots.length; s++) {
    let item = container.slots[s] ? container.slots[s].item : null;
    if (item) {
      total += this.__getCoinValue(item);
      if (item.slots && item.slots.length > 0) {
        total += this.__countGoldRecursive(item);
      }
    }
  }
  return total;
}

OfferModal.prototype.__getTotalMoney = function () {
  let total = 0;
  let player = gameClient.player;
  if (!player) return 0;

  if (player.equipment) {
    total += this.__countGoldRecursive(player.equipment);
  }

  if (player.__openedContainers) {
    let containers = Array.from(player.__openedContainers);
    for (let c of containers) {
      total += this.__countGoldRecursive(c);
    }
  }

  return total;
}

OfferModal.prototype.__renderNpcAvatar = function () {
  let NPC = gameClient.world.getCreature(this.__npcId);
  if (!NPC) return;

  document.getElementById("trade-npc-name").textContent = NPC.name;

  let canvas = document.getElementById("trade-npc-canvas");
  let ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 48, 48);
  ctx.imageSmoothingEnabled = true;

  let outfit = NPC.outfit;
  if (!outfit) return;

  let outfitData = outfit.getDataObject();
  if (!outfitData) return;

  let item = outfitData.getFrameGroup(0);
  if (!item) return;

  let totalW = item.width * 32;
  let totalH = item.height * 32;
  let startX = Math.round((48 - totalW) / 2);
  let startY = Math.round((48 - totalH) / 2);

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

OfferModal.prototype.handleOpen = function (properties) {
  this.__npcId = properties.id;
  this.__offers = properties.offers;
  this.__owned = properties.owned || [];
  this.__lastGold = Math.max(
    typeof properties.gold === "number" ? properties.gold : 0,
    this.__getTotalMoney()
  );

  this.__selectedElement = null;
  this.__selectedOffer = null;
  this.__selectedQuantity = 1;

  document.getElementById("trade-search").value = "";

  let cap = gameClient.player.state.capacity;
  document.getElementById("capacity").textContent = cap;

  document.getElementById("money").textContent = this.__lastGold.toLocaleString();

  this.__renderNpcAvatar();
  this.__offerType = null;
  this.setOfferType("buy");
  this.setTitle(__("modal.offer.npc_trade"));
}

OfferModal.prototype.handleConfirm = function () {
  if (this.__selectedOffer === null) return;

  if (this.__offerType === "sell") {
    gameClient.send(new OfferSellPacket(this.__npcId, this.__selectedOffer, this.__selectedQuantity));
  } else {
    gameClient.send(new OfferBuyPacket(this.__npcId, this.__selectedOffer, this.__selectedQuantity));
  }
  return false;
}
