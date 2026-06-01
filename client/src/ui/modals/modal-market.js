function formatPrice(value) {
  if (value >= 1000000000) {
    let v = value / 1000000000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "B";
  }
  if (value >= 1000000) {
    let v = value / 1000000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "M";
  }
  if (value >= 1000) {
    let v = value / 1000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "k";
  }
  return value.toString();
}

const MarketModal = function(id) {
  Modal.call(this, id);
  this.__mode = null;
  this.__items = [];
  this.__setupItems = [];
  this.__sellerId = null;
  this.__sellerName = "";
  this.__shopName = "";
  this.__gold = 0;
  this.__retroGold = 0;

  this.__headerEl = document.getElementById("market-header");
  this.__shopNameEl = document.getElementById("market-shop-name");
  this.__itemListEl = document.getElementById("market-item-list");
  this.__ownerInfoEl = document.getElementById("market-owner-info");
  this.__earningsGoldEl = document.getElementById("market-earnings-gold");
  this.__earningsRetroEl = document.getElementById("market-earnings-retro");
  this.__actionBtn = document.getElementById("market-action-btn");
  this.__actionBtn.addEventListener("click", this.__onAction.bind(this));
  this.__buyOverlay = document.getElementById("market-buy-overlay");
  this.__buyConfirmBtn = document.getElementById("market-buy-confirm");
  this.__buyCancelBtn = document.getElementById("market-buy-cancel");
  this.__buyConfirmBtn.addEventListener("click", this.__onBuyConfirm.bind(this));
  this.__buyCancelBtn.addEventListener("click", this.__onBuyCancel.bind(this));
  this.__buyCountSlider = document.getElementById("market-buy-count-slider");
  this.__buyCountDisplay = document.getElementById("market-buy-count-display");
  this.__buyCountSlider.addEventListener("input", this.__onBuyCountChange.bind(this));

  this.__pendingBuy = null;

  this.__setupEl = document.getElementById("market-setup");
  this.__setupNameEl = document.getElementById("market-setup-name");
  this.__setupSlotsEl = document.getElementById("market-setup-slots");
  this.__setupConfirmEl = document.getElementById("market-setup-confirm");
  this.__setupConfirmEl.addEventListener("click", this.__onSetupConfirm.bind(this));
  this.__setupNameEl.addEventListener("input", this.__onSetupInput.bind(this));
  this.__countOverlay = document.getElementById("market-count-overlay");
  this.__countSlider = document.getElementById("market-count-slider");
  this.__countDisplay = document.getElementById("market-count-display");
  this.__countConfirmBtn = document.getElementById("market-count-confirm");
  this.__countCancelBtn = document.getElementById("market-count-cancel");
  this.__countConfirmBtn.addEventListener("click", this.__onCountConfirm.bind(this));
  this.__countCancelBtn.addEventListener("click", this.__onCountCancel.bind(this));
  this.__countSlider.addEventListener("input", this.__onCountChange.bind(this));
  this.__pendingCountCallback = null;
  this.__coinGoldCanvas = null;
  this.__coinRetroCanvas = null;
  this.__coinSpritesLoading = false;
};

MarketModal.prototype = Object.create(Modal.prototype);
MarketModal.prototype.constructor = MarketModal;

MarketModal.prototype.handleOpen = function () {
  this.__mode = null;
  this.__items = [];
  this.__pendingBuy = null;
  this.__sellerCreature = null;
  this.__hideAll();
  this.__clearPosition();
};

MarketModal.prototype.__clearPosition = function () {
};

MarketModal.prototype.__createPriceElement = function (value, coinCanvas) {
  let container = document.createElement("div");
  container.className = "market-price-entry";

  let icon = document.createElement("canvas");
  icon.width = 10;
  icon.height = 10;
  if (coinCanvas) {
    let ctx = icon.getContext("2d");
    ctx.drawImage(coinCanvas, 0, 0, 10, 10);
  }

  let text = document.createElement("span");
  text.className = "market-coin-label";
  text.textContent = formatPrice(value);

  container.appendChild(icon);
  container.appendChild(text);
  return container;
};

MarketModal.prototype.__positionAboveSeller = function () {
};

MarketModal.prototype.handleCancel = function () {
  if (this.__mode === "owner") {
    gameClient.send(new MarketClosePacket());
  }
  this.__clearPosition();
  return true;
};

MarketModal.prototype.__hideAll = function () {
  this.__shopNameEl.style.display = "none";
  this.__ownerInfoEl.style.display = "none";
  this.__actionBtn.style.display = "none";
  this.__setupEl.style.display = "none";
  this.__itemListEl.style.display = "none";
  this.__countOverlay.style.display = "none";
};

MarketModal.prototype.openAsOwner = function (shopName, items, gold, retroGold) {
  this.__mode = "owner";
  this.__shopName = shopName || "";
  this.__items = items || [];
  this.__gold = gold || 0;
  this.__retroGold = retroGold || 0;
  this.__renderOwner();
};

MarketModal.prototype.openAsBuyer = function (sellerName, shopName, items, sellerId, sellerCreature) {
  this.__mode = "buyer";
  this.__sellerName = sellerName || "";
  this.__shopName = shopName || "";
  this.__items = items || [];
  this.__sellerId = sellerId || null;
  this.__sellerCreature = sellerCreature || null;
  if (!this.__coinSpritesLoading) {
    this.__coinSpritesLoading = true;
    this.__renderCoinSprites();
  }

  this.__renderBuyer();
};

MarketModal.prototype.handleBuyResult = function (success, message) {
  this.__buyOverlay.style.display = "none";
  this.__pendingBuy = null;
};

MarketModal.prototype.openAsSetup = function () {
  this.__mode = "setup";
  this.__setupItems = [];
  this.__renderSetup();
};

MarketModal.prototype.__renderOwner = function () {
  this.__hideAll();
  this.__headerEl.textContent = "Your Market";
  this.__shopNameEl.textContent = this.__shopName || "No name";
  this.__shopNameEl.style.display = "block";
  this.__ownerInfoEl.style.display = "flex";
  this.__earningsGoldEl.textContent = this.__gold;
  this.__earningsRetroEl.textContent = this.__retroGold;
  this.__actionBtn.textContent = "Close Market";
  this.__actionBtn.style.display = "block";
  this.__itemListEl.style.display = "block";
  this.__renderItems(false);
};

MarketModal.prototype.__renderBuyer = function () {
  this.__hideAll();
  this.__headerEl.textContent = this.__sellerName + "'s Market";
  this.__shopNameEl.textContent = this.__shopName || "";
  this.__shopNameEl.style.display = this.__shopName ? "block" : "none";
  this.__itemListEl.style.display = "block";
  this.__renderItems(true);
  this.__positionAboveSeller();
};

MarketModal.prototype.__renderCoinSprites = function () {
  this.__coinGoldCanvas = null;
  this.__coinRetroCanvas = null;

  let coins = [
    { key: "__coinGoldCanvas", path: "/images/game/console/goldcoin.png" },
    { key: "__coinRetroCanvas", path: "/images/game/console/retrogocoin.png" }
  ];

  let loaded = 0;
  let total = coins.length;

  coins.forEach(function (coin) {
    let img = new Image();
    img.onload = function () {
      let c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      let ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, 32, 32);
      this[coin.key] = c;

      loaded++;
      if (loaded === total) {
        this.__coinSpritesRendered = true;
        if (this.__mode === "setup") {
          this.__renderSetupSlots();
        } else if (this.__mode === "buyer") {
          this.__renderItems(true);
        }
      }
    }.bind(this);
    img.onerror = function () {
      loaded++;
      if (loaded === total) {
        this.__coinSpritesRendered = false;
      }
    }.bind(this);
    img.src = coin.path;
  }, this);
};

MarketModal.prototype.__renderSetup = function () {
  this.__hideAll();
  this.__headerEl.textContent = "Start a Market";
  this.__setupEl.style.display = "block";
  this.__setupNameEl.value = "";
  this.__setupItems = [];
  if (!this.__coinSpritesLoading) {
    this.__coinSpritesLoading = true;
    this.__renderCoinSprites();
  }
  this.__renderSetupSlots();
  this.__updateSetupConfirm();
};

MarketModal.prototype.__renderSetupSlots = function () {
  this.__setupSlotsEl.innerHTML = "";
  if (this.__setupItems.length === 0) {
    let empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = "Drag items here.";
    this.__setupSlotsEl.appendChild(empty);
    return;
  }

  let goldCoin = this.__coinGoldCanvas;
  let retroCoin = this.__coinRetroCanvas;

  this.__setupItems.forEach(function (item, index) {
    let wrapper = document.createElement("div");
    wrapper.className = "market-setup-entry-wrapper";
    wrapper.dataset.index = index;

    let entry = document.createElement("div");
    entry.className = "market-setup-entry";

    let spriteWrap = document.createElement("div");
    spriteWrap.className = "market-entry-sprite";

    let canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    let itemObj = new Item(item.id, item.count || 1);
    let frameGroup = itemObj.getFrameGroup(FrameGroup.prototype.NONE);
    if (frameGroup) {
      let frame = itemObj.getFrame();
      let pattern = itemObj.getPattern();
      let spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
      let spriteSrc = frameGroup.getSprite(spriteIndex);
      if (spriteSrc && spriteSrc.src) {
        let ctx = canvas.getContext("2d");
        ctx.drawImage(spriteSrc.src, 32 * spriteSrc.position.x, 32 * spriteSrc.position.y, 32, 32, 0, 0, 32, 32);
      }
    }

    spriteWrap.appendChild(canvas);
    if ((item.count || 1) > 1) {
      let countLabel = document.createElement("span");
      countLabel.className = "market-item-count-label";
      countLabel.textContent = String(item.count);
      spriteWrap.appendChild(countLabel);
    }
    spriteWrap.addEventListener("mouseenter", function () {
      let iObj = new Item(item.id, item.count || 1);
      gameClient.interface.tooltip.show(iObj, spriteWrap);
    });
    spriteWrap.addEventListener("mouseleave", function () {
      gameClient.interface.tooltip.hide();
    });

    let hasPrice = (item.priceGold || 0) > 0 || (item.priceRetro || 0) > 0;
    spriteWrap.addEventListener("click", function () {
      if (hasPrice) {
        this.__showItemOptions(wrapper, index);
      }
    }.bind(this));

    let coinsBar = document.createElement("div");
    coinsBar.className = "market-entry-coins";

    let goldHalf = document.createElement("div");
    goldHalf.className = "market-coin-half gold";
    let goldIcon = document.createElement("canvas");
    goldIcon.width = 28;
    goldIcon.height = 28;
    goldIcon.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)";
    if (goldCoin) {
      let gctx = goldIcon.getContext("2d");
      gctx.drawImage(goldCoin, 0, 0, 28, 28);
    }
    goldHalf.appendChild(goldIcon);
    goldHalf.addEventListener("click", function (e) {
      e.stopPropagation();
      this.__toggleCoinEditor(wrapper, index, "gold", item);
    }.bind(this));
    coinsBar.appendChild(goldHalf);

    let retroHalf = document.createElement("div");
    retroHalf.className = "market-coin-half retro";
    let retroIcon = document.createElement("canvas");
    retroIcon.width = 28;
    retroIcon.height = 28;
    retroIcon.style.cssText = "position:absolute;top:46%;left:50%;transform:translate(-50%,-50%)";
    if (retroCoin) {
      let rctx = retroIcon.getContext("2d");
      rctx.drawImage(retroCoin, 0, 0, 28, 28);
    }
    retroHalf.appendChild(retroIcon);
    retroHalf.addEventListener("click", function (e) {
      e.stopPropagation();
      this.__toggleCoinEditor(wrapper, index, "retro", item);
    }.bind(this));
    coinsBar.appendChild(retroHalf);

    var priceRow = document.createElement("div");
    priceRow.className = "market-price-row";
    if (item.priceGold > 0) {
      priceRow.appendChild(this.__createPriceElement(item.priceGold, goldCoin));
    }
    if (item.priceRetro > 0) {
      priceRow.appendChild(this.__createPriceElement(item.priceRetro, retroCoin));
    }

    entry.appendChild(spriteWrap);
    entry.appendChild(coinsBar);
    entry.appendChild(priceRow);
    wrapper.appendChild(entry);
    this.__setupSlotsEl.appendChild(wrapper);
  }, this);
};

MarketModal.prototype.__toggleCoinEditor = function (wrapper, index, type, item) {
  let existing = wrapper.querySelector(".market-entry-editor");
  let existingType = existing ? existing.dataset.type : null;

  if (existing && existingType === type) {
    existing.remove();
    return;
  }

  if (existing) {
    existing.remove();
  }

  let priceKey = type === "gold" ? "priceGold" : "priceRetro";

  let editor = document.createElement("div");
  editor.className = "market-entry-editor";
  editor.dataset.type = type;

  let input = document.createElement("input");
  input.type = "number";
  input.className = "input-botao";
  input.min = "0";
  input.placeholder = type === "gold" ? "Gold price" : "Retro price";
  input.value = item[priceKey] > 0 ? item[priceKey] : "";

  let okBtn = document.createElement("button");
  okBtn.className = "btn-botao";
  okBtn.textContent = "OK";

  let cancelBtn = document.createElement("button");
  cancelBtn.className = "btn-botao";
  cancelBtn.textContent = "CANCEL";

  editor.appendChild(input);
  editor.appendChild(okBtn);
  editor.appendChild(cancelBtn);

  okBtn.addEventListener("click", function () {
    let val = parseInt(input.value) || 0;
    item[priceKey] = val;
    editor.remove();
    this.__renderSetupSlots();
    this.__updateSetupConfirm();
  }.bind(this));

  cancelBtn.addEventListener("click", function () {
    editor.remove();
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") okBtn.click();
    if (e.key === "Escape") cancelBtn.click();
  });

  wrapper.appendChild(editor);
  input.focus();
};

MarketModal.prototype.__showItemOptions = function (wrapper, index) {
  let existing = wrapper.querySelector(".market-entry-options");
  if (existing) {
    existing.remove();
    return;
  }

  let opts = document.createElement("div");
  opts.className = "market-entry-options";

  let editBtn = document.createElement("button");
  editBtn.className = "btn-botao";
  editBtn.textContent = "Edit";
  editBtn.addEventListener("click", function () {
    opts.remove();
    let item = this.__setupItems[index];
    if (!item) return;
    if (item.priceGold > 0) {
      this.__toggleCoinEditor(wrapper, index, "gold", item);
    } else if (item.priceRetro > 0) {
      this.__toggleCoinEditor(wrapper, index, "retro", item);
    } else {
      this.__toggleCoinEditor(wrapper, index, "gold", item);
    }
  }.bind(this));

  let removeBtn = document.createElement("button");
  removeBtn.className = "btn-botao";
  removeBtn.textContent = "Remove";
  removeBtn.style.cssText = "background:#5a1a1a;border-color:#8a2a2a;";
  removeBtn.addEventListener("click", function () {
    this.__setupItems.splice(index, 1);
    this.__renderSetupSlots();
    this.__updateSetupConfirm();
  }.bind(this));

  opts.appendChild(editBtn);
  opts.appendChild(removeBtn);
  wrapper.appendChild(opts);
};

MarketModal.prototype.__onSetupInput = function () {
  this.__updateSetupConfirm();
};

MarketModal.prototype.__addDraggedItem = function (item) {
  if (this.__mode !== "setup") return;

  let existing = this.__setupItems.find(function (si) { return si.id === item.id; });
  if (existing) {
    existing.count += item.count || 1;
  } else {
    this.__setupItems.push({
      id: item.id,
      name: "Item " + item.id,
      count: item.count || 1,
      priceGold: 0,
      priceRetro: 0
    });
  }
  this.__renderSetupSlots();
  this.__updateSetupConfirm();
};

MarketModal.prototype.__showCountSelector = function (maxCount, callback) {
  this.__pendingCountCallback = callback;
  this.__countSlider.max = String(maxCount);
  this.__countSlider.value = String(maxCount);
  this.__countDisplay.textContent = String(maxCount);
  this.__countOverlay.style.display = "flex";
};

MarketModal.prototype.__onCountChange = function () {
  this.__countDisplay.textContent = this.__countSlider.value;
};

MarketModal.prototype.__onCountConfirm = function () {
  let count = parseInt(this.__countSlider.value, 10);
  this.__countOverlay.style.display = "none";
  if (this.__pendingCountCallback) {
    this.__pendingCountCallback(count);
    this.__pendingCountCallback = null;
  }
};

MarketModal.prototype.__onCountCancel = function () {
  this.__countOverlay.style.display = "none";
  this.__pendingCountCallback = null;
};

MarketModal.prototype.__countTotalItems = function (itemId) {
  let total = 0;
  let seen = new Set();

  function scan(container) {
    if (!container || !container.slots) return;
    if (container.__containerId !== undefined && seen.has(container.__containerId)) return;
    if (container.__containerId !== undefined) seen.add(container.__containerId);

    for (let i = 0; i < container.slots.length; i++) {
      let sl = container.slots[i];
      if (!sl || !sl.item) continue;
      if (sl.item.id === itemId) {
        total += sl.item.count || 1;
      }
      if (sl.item.isContainer && sl.item.isContainer() && sl.item.__openContainerId !== undefined) {
        let sub = null;
        gameClient.player.__openedContainers.forEach(function (c) {
          if (c.__containerId === sl.item.__openContainerId) sub = c;
        });
        if (sub) scan(sub);
      }
    }
  }

  if (gameClient.player) {
    if (gameClient.player.equipment) scan(gameClient.player.equipment);
    gameClient.player.__openedContainers.forEach(function (c) { scan(c); });
  }

  return total;
};

MarketModal.prototype.__updateSetupConfirm = function () {
  let name = this.__setupNameEl.value.trim();
  let hasItems = this.__setupItems.length > 0;
  let hasPrices = this.__setupItems.some(function (item) {
    return (item.priceGold || 0) > 0 || (item.priceRetro || 0) > 0;
  });
  this.__setupConfirmEl.disabled = !(name.length >= 3 && hasItems && hasPrices);
};

MarketModal.prototype.__onSetupConfirm = function () {
  let name = this.__setupNameEl.value.trim();
  if (name.length < 3) {
    gameClient.interface.setCancelMessage("Shop name must be at least 3 characters.");
    return;
  }
  if (this.__setupItems.length === 0) {
    gameClient.interface.setCancelMessage("Add at least one item to your shop.");
    return;
  }
  let items = this.__setupItems.map(function (item) {
    return {
      id: item.id,
      count: item.count,
      priceGold: item.priceGold || 0,
      priceRetro: item.priceRetro || 0
    };
  });
  gameClient.send(new MarketStartPacket(name, items));
  gameClient.interface.modalManager.close();
};

MarketModal.prototype.__renderItems = function (clickable) {
  this.__itemListEl.innerHTML = "";
  if (!this.__items || this.__items.length === 0) {
    let empty = document.createElement("div");
    empty.className = "market-empty";
    empty.textContent = "No items in this shop.";
    this.__itemListEl.appendChild(empty);
    return;
  }

  let goldCoin = this.__coinGoldCanvas;
  let retroCoin = this.__coinRetroCanvas;

  this.__items.forEach(function (item, index) {
    let wrapper = document.createElement("div");
    wrapper.className = "market-setup-entry-wrapper";
    wrapper.dataset.index = index;
    if (clickable) {
      wrapper.classList.add("market-item-clickable");
    }

    let entry = document.createElement("div");
    entry.className = "market-setup-entry";

    let spriteWrap = document.createElement("div");
    spriteWrap.className = "market-entry-sprite";

    let canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    let itemObj = new Item(item.id, item.count || 1);
    let frameGroup = itemObj.getFrameGroup(FrameGroup.prototype.NONE);
    if (frameGroup) {
      let frame = itemObj.getFrame();
      let pattern = itemObj.getPattern();
      let spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
      let spriteSrc = frameGroup.getSprite(spriteIndex);
      if (spriteSrc && spriteSrc.src) {
        let ctx = canvas.getContext("2d");
        ctx.drawImage(spriteSrc.src, 32 * spriteSrc.position.x, 32 * spriteSrc.position.y, 32, 32, 0, 0, 32, 32);
      }
    }

    spriteWrap.appendChild(canvas);
    if ((item.count || 1) > 1) {
      let countLabel = document.createElement("span");
      countLabel.className = "market-item-count-label";
      countLabel.textContent = String(item.count);
      spriteWrap.appendChild(countLabel);
    }
    spriteWrap.addEventListener("mouseenter", function () {
      let iObj = new Item(item.id, item.count || 1);
      gameClient.interface.tooltip.show(iObj, spriteWrap);
    });
    spriteWrap.addEventListener("mouseleave", function () {
      gameClient.interface.tooltip.hide();
    });

    let priceRow = document.createElement("div");
    priceRow.className = "market-price-row";

    if (item.priceGold > 0) {
      let el = document.createElement("div");
      el.className = "market-price-entry";
      let icon = document.createElement("canvas");
      icon.width = 28;
      icon.height = 28;
      if (goldCoin) {
        let ctx = icon.getContext("2d");
        ctx.drawImage(goldCoin, 0, 0, 28, 28);
      }
      let text = document.createElement("span");
      text.className = "market-coin-label";
      text.textContent = formatPrice(item.priceGold);
      el.appendChild(icon);
      el.appendChild(text);
      priceRow.appendChild(el);
    }

    if (item.priceRetro > 0) {
      let el = document.createElement("div");
      el.className = "market-price-entry";
      let icon = document.createElement("canvas");
      icon.width = 28;
      icon.height = 28;
      if (retroCoin) {
        let ctx = icon.getContext("2d");
        ctx.drawImage(retroCoin, 0, 0, 28, 28);
      }
      let text = document.createElement("span");
      text.className = "market-coin-label retro";
      text.textContent = formatPrice(item.priceRetro);
      el.appendChild(icon);
      el.appendChild(text);
      priceRow.appendChild(el);
    }

    entry.appendChild(spriteWrap);
    entry.appendChild(priceRow);
    wrapper.appendChild(entry);

    if (clickable) {
      wrapper.addEventListener("click", this.__onItemClick.bind(this, index));
    }

    this.__itemListEl.appendChild(wrapper);
  }, this);
};

MarketModal.prototype.__onItemClick = function (index) {
  let item = this.__items[index];
  if (!item) return;
  let max = Math.max(1, item.count || 1);
  this.__buyCountSlider.max = max;
  this.__buyCountSlider.value = 1;
  this.__buyCountDisplay.textContent = "1";
  this.__pendingBuy = { index: index, item: item, count: 1 };
  this.__buyOverlay.style.display = "flex";
};

MarketModal.prototype.__onBuyCountChange = function () {
  this.__buyCountDisplay.textContent = this.__buyCountSlider.value;
  if (this.__pendingBuy) {
    this.__pendingBuy.count = parseInt(this.__buyCountSlider.value, 10);
  }
};

MarketModal.prototype.__onBuyConfirm = function () {
  if (!this.__pendingBuy || !this.__sellerId) return;
  let item = this.__pendingBuy.item;
  let count = this.__pendingBuy.count || 1;
  if (count > (item.count || 1)) {
    gameClient.interface.setCancelMessage("Not enough stock.");
    return;
  }
  let useRetro = (item.priceGold || 0) <= 0 && (item.priceRetro || 0) > 0;
  let price = useRetro ? item.priceRetro : item.priceGold;
  if (price <= 0) {
    gameClient.interface.setCancelMessage("This item has no price set.");
    return;
  }
  gameClient.send(new MarketBuyPacket(this.__sellerId, this.__pendingBuy.index, count, useRetro));
  this.__buyOverlay.style.display = "none";
  this.__pendingBuy = null;
};

MarketModal.prototype.__onBuyCancel = function () {
  this.__buyOverlay.style.display = "none";
  this.__pendingBuy = null;
};

MarketModal.prototype.__onAction = function () {
  if (this.__mode === "owner") {
    gameClient.send(new MarketClosePacket());
  }
};