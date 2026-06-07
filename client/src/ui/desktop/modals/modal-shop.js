"use strict";

const ShopModal = function (id) {
  Modal.call(this, id);
  this.__balance = 0;
  this.__activeCategory = null;
  this.__categoriesEl = document.getElementById("shop-categories");
  this.__itemsEl = document.getElementById("shop-items");
  this.__balanceEl = document.getElementById("shop-balance-value");
  this.__animEntries = [];
  this.__scrollbarThumb = document.getElementById("shop-scrollbar-thumb");
  this.__scrollbarTrack = document.getElementById("shop-scrollbar");
  this.__dragging = false;
  this.__pendingItemId = null;
  this.__outfitSpriteBuffer = new SpriteBuffer(2);
  this.__outfitPreviewCanvas = document.createElement("canvas");
  this.__outfitPreviewCanvas.width = 32;
  this.__outfitPreviewCanvas.height = 32;
  this.__outfitPreview = new Canvas(this.__outfitPreviewCanvas, 32, 32);
  this.__initScrollbar();
  this.__initConfirm();
};

ShopModal.prototype = Object.create(Modal.prototype);
ShopModal.prototype.constructor = ShopModal;

ShopModal.prototype.updateBalance = function (balance) {
  this.__balance = balance;
  this.__balanceEl.textContent = balance;
};

ShopModal.prototype.__initConfirm = function () {
  var self = this;
  document.getElementById("shop-confirm-yes").addEventListener("click", function () {
    if (self.__pendingItemId !== null) {
      gameClient.send(new BuyPremiumItemPacket(self.__pendingItemId, 1));
    }
    self.__hideConfirm();
  });
  document.getElementById("shop-confirm-no").addEventListener("click", function () {
    self.__hideConfirm();
  });
};

ShopModal.prototype.__showConfirm = function (itemName, price, itemId) {
  document.getElementById("shop-confirm-text").textContent = __("modal.shop.buy_for", itemName, price);
  document.getElementById("shop-confirm-area").style.display = "block";
  this.__pendingItemId = itemId;
};

ShopModal.prototype.__hideConfirm = function () {
  document.getElementById("shop-confirm-area").style.display = "none";
  this.__pendingItemId = null;
};

ShopModal.prototype.__initStripeButton = function () {
  var self = this;
  var btn = document.getElementById("shop-stripe-btn");
  if (btn) {
    btn.addEventListener("click", function () {
      gameClient.interface.modalManager.open("payment-modal");
    });
  }
};

ShopModal.prototype.handleOpen = function () {
  this.__renderCategories();
  this.__initStripeButton();
  if (SHOP_CATEGORIES.length > 0) {
    this.__selectCategory(SHOP_CATEGORIES[0].name);
  }
  gameClient.send(new RequestPremiumBalancePacket());
};

ShopModal.prototype.__renderCategories = function () {
  this.__categoriesEl.innerHTML = "";
  var CATEGORY_KEYS = ["modal.shop.category_training", "modal.shop.category_tools", "modal.shop.category_premium", "modal.shop.category_outfits", "modal.shop.category_boosts", "modal.shop.category_starter_box"];
  var ICON_FILES = ["icon-cat-weapons.png", "icon-cat-tools.png", "icon-cat-premium.png", "icon-cat-outfits.png", "icon-cat-boost.png", "gift_01a.png"];
  SHOP_CATEGORIES.forEach(function (cat, idx) {
    var btn = document.createElement("button");
    btn.className = "shop-cat-btn";

    var icon = document.createElement("img");
    icon.className = "shop-cat-icon";
    icon.src = "images/icons/" + (ICON_FILES[idx] || "");
    icon.alt = "";
    icon.width = 16;
    icon.height = 16;

    var label = document.createElement("span");
    label.textContent = __(CATEGORY_KEYS[idx] || cat.name, cat.name);

    btn.appendChild(icon);
    btn.appendChild(label);
    btn.addEventListener("click", this.__selectCategory.bind(this, cat.name));
    this.__categoriesEl.appendChild(btn);
  }, this);
};

ShopModal.prototype.__selectCategory = function (name) {
  this.__activeCategory = name;
  var btns = this.__categoriesEl.querySelectorAll(".shop-cat-btn");
  Array.from(btns).forEach(function (b) {
    var label = b.querySelector("span");
    b.classList.toggle("active", label && label.textContent === name);
  });
  this.__renderItems(name);
};

ShopModal.prototype.handleRender = function () {
  for (var i = 0; i < this.__animEntries.length; i++) {
    var e = this.__animEntries[i];
    if (e.itemId >= 65001 && e.itemId <= 65008) {
      var ctx = e.canvas.getContext("2d");
      ctx.clearRect(0, 0, 32, 32);
      this.__drawOutfitPreview(ctx, e.itemId);
    } else {
      this.__drawItemSprite(e.canvas.getContext("2d"), e.itemId);
    }
  }
};

ShopModal.prototype.__getGenderMatch = function () {
  if (!gameClient.player) return "male";
  var id = gameClient.player.outfit.id;
  if ((id >= 111 && id <= 117) || (id >= 126 && id <= 129)) return "male";
  return "female";
}

ShopModal.prototype.__renderItems = function (categoryName) {
  this.__animEntries = [];
  this.__itemsEl.innerHTML = "";
  var cat = null;
  for (var i = 0; i < SHOP_CATEGORIES.length; i++) {
    if (SHOP_CATEGORIES[i].name === categoryName) {
      cat = SHOP_CATEGORIES[i];
      break;
    }
  }
  if (!cat || !cat.items || cat.items.length === 0) {
    this.__itemsEl.innerHTML = '<div class="shop-empty">' + __("modal.shop.no_items") + '</div>';
    this.__itemsEl.scrollTop = 0;
    this.__updateScrollbar();
    return;
  }
  var gender = this.__getGenderMatch();
  cat.items.forEach(function (item) {
    if (item.id >= 65001 && item.id <= 65008) {
      if (gender === "male" && item.id >= 65005) return;
      if (gender === "female" && item.id <= 65004) return;
    }
    var entry = document.createElement("div");
    entry.className = "shop-item-entry";

    var icon;
    var isService = item.id >= 64000;
    if (isService && (item.id === 64004 || item.id === 64005 || item.id === 64006)) {
      icon = document.createElement("img");
      icon.className = "shop-item-img";
      var iconSrc = item.id === 64004 ? "images/game/console/exp.png" : item.id === 64005 ? "images/game/console/loot.png" : "images/game/console/skills.png";
      icon.src = iconSrc;
      icon.alt = item.id === 64004 ? "EXP" : item.id === 64005 ? "DROP" : "SKILLS";
      icon.width = 44;
      icon.height = 92;
      icon.style.setProperty("width", "44px", "important");
      icon.style.setProperty("height", "92px", "important");
    } else if (isService && ((item.id >= 64001 && item.id <= 64003) || item.id === 64007)) {
      var days = item.id === 64001 ? 30 : item.id === 64002 ? 90 : item.id === 64003 ? 180 : 365;
      icon = document.createElement("img");
      icon.className = "shop-item-img";
      icon.src = "images/game/console/" + days + ".png";
      icon.alt = days + " Days";
      icon.width = 32;
      icon.height = 32;
    } else if (item.id >= 65001 && item.id <= 65008) {
      icon = document.createElement("canvas");
      icon.className = "shop-item-icon";
      icon.width = 32;
      icon.height = 32;
      this.__drawOutfitPreview(icon.getContext("2d"), item.id);
      this.__animEntries.push({ canvas: icon, itemId: item.id });
    } else {
      icon = document.createElement("canvas");
      icon.className = "shop-item-icon";
      icon.width = 32;
      icon.height = 32;
      this.__drawItemSprite(icon.getContext("2d"), item.id);
      this.__animEntries.push({ canvas: icon, itemId: item.id });
    }

    var info = document.createElement("div");
    info.className = "shop-item-info";

    var nameEl = document.createElement("div");
    nameEl.className = "shop-item-name";
    nameEl.textContent = item.name;

    var descEl = document.createElement("div");
    descEl.className = "shop-item-desc";
    descEl.textContent = item.desc;

    info.appendChild(nameEl);
    info.appendChild(descEl);

    var priceEl = document.createElement("div");
    priceEl.className = "shop-item-price";
    priceEl.innerHTML = item.price + ' <img src="images/game/console/retrogocoin.png" class="shop-coin-icon" alt="">';

    var buyBtn = document.createElement("button");
    buyBtn.className = "shop-buy-btn";
    buyBtn.textContent = __("common.buy");
    (function (modal, itemId, price, itemName) {
      buyBtn.addEventListener("click", function () {
        if (modal.__balance < price) {
          gameClient.interface.setCancelMessage(__("modal.shop.not_enough_points", price));
          return;
        }
        modal.__showConfirm(itemName, price, itemId);
      });
    })(this, item.id, item.price, item.name);

    entry.appendChild(icon);
    entry.appendChild(info);
    entry.appendChild(priceEl);
    entry.appendChild(buyBtn);
    this.__itemsEl.appendChild(entry);
  }, this);
  this.__itemsEl.scrollTop = 0;
  this.__updateScrollbar();
};

ShopModal.prototype.__initScrollbar = function () {
  var self = this;
  this.__scrollbarThumb.addEventListener("mousedown", function (e) {
    e.stopPropagation();
    self.__dragging = true;
    var startY = e.clientY;
    var startTop = parseFloat(self.__scrollbarThumb.style.top) || 0;
    function onMove(ev) {
      if (!self.__dragging) return;
      var trackHeight = self.__scrollbarTrack.clientHeight;
      var thumbHeight = self.__scrollbarThumb.clientHeight;
      var maxTop = trackHeight - thumbHeight;
      var dy = ev.clientY - startY;
      var newTop = Math.max(0, Math.min(maxTop, startTop + dy));
      self.__scrollbarThumb.style.top = newTop + "px";
      var ratio = maxTop > 0 ? newTop / maxTop : 0;
      self.__itemsEl.scrollTop = ratio * (self.__itemsEl.scrollHeight - self.__itemsEl.clientHeight);
    }
    function onUp() {
      self.__dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
  this.__scrollbarTrack.addEventListener("mousedown", function (e) {
    if (e.target === self.__scrollbarThumb) return;
    var trackRect = self.__scrollbarTrack.getBoundingClientRect();
    var thumbH = self.__scrollbarThumb.clientHeight;
    var clickY = e.clientY - trackRect.top - thumbH / 2;
    var maxTop = self.__scrollbarTrack.clientHeight - thumbH;
    clickY = Math.max(0, Math.min(maxTop, clickY));
    self.__scrollbarThumb.style.top = clickY + "px";
    var ratio = maxTop > 0 ? clickY / maxTop : 0;
    self.__itemsEl.scrollTop = ratio * (self.__itemsEl.scrollHeight - self.__itemsEl.clientHeight);
  });
  this.__itemsEl.addEventListener("scroll", function () {
    if (self.__dragging) return;
    self.__syncThumbFromScroll();
  });
};

ShopModal.prototype.__syncThumbFromScroll = function () {
  var trackH = this.__scrollbarTrack.clientHeight;
  var contentH = this.__itemsEl.scrollHeight;
  var viewH = this.__itemsEl.clientHeight;
  var maxScroll = contentH - viewH;
  if (maxScroll <= 0) {
    this.__scrollbarThumb.style.top = "0px";
    return;
  }
  var ratio = this.__itemsEl.scrollTop / maxScroll;
  var thumbH = this.__scrollbarThumb.clientHeight;
  var maxTop = trackH - thumbH;
  this.__scrollbarThumb.style.top = (ratio * maxTop) + "px";
};

ShopModal.prototype.__updateScrollbar = function () {
  var self = this;
  requestAnimationFrame(function () {
    var contentH = self.__itemsEl.scrollHeight;
    var viewH = self.__itemsEl.clientHeight;
    var trackH = self.__scrollbarTrack.clientHeight;
    if (contentH <= viewH) {
      self.__scrollbarThumb.style.display = "none";
      return;
    }
    self.__scrollbarThumb.style.display = "block";
    var thumbH = Math.max(12, trackH * viewH / contentH);
    self.__scrollbarThumb.style.height = thumbH + "px";
    self.__syncThumbFromScroll();
  });
};

ShopModal.prototype.__drawOutfitPreview = function (ctx, shopItemId) {
  try {
    if (!gameClient.player) return;
    var outfitIdMap = { 65001:126, 65002:127, 65003:128, 65004:129, 65005:130, 65006:131, 65007:132, 65008:133 };
    var outfitId = outfitIdMap[shopItemId];
    if (!outfitId) return;
    var outfit = new Outfit({
      id: outfitId,
      details: gameClient.player.outfit.details,
      addonOne: false,
      addonTwo: false
    });
    var dataObj = outfit.getDataObject();
    if (!dataObj) return;
    var frameGroup = dataObj.getFrameGroup(0);
    if (!frameGroup) return;
    this.__outfitSpriteBuffer.clear();
    this.__outfitPreview.clear();
    this.__outfitPreview.__drawCharacter(
      this.__outfitSpriteBuffer,
      outfit,
      new Position(0, 0),
      frameGroup,
      0,
      2,
      0,
      32,
      0
    );
    ctx.drawImage(this.__outfitPreviewCanvas, 0, 0);
  } catch (e) {
    console.warn("[Shop] Failed to draw outfit preview", e);
  }
}

ShopModal.prototype.__drawItemSprite = function (ctx, itemId) {
  try {
    if (itemId === 3138) {
      var dummyImg = new Image();
      dummyImg.src = "images/game/console/trainingdummy.png";
      if (dummyImg.complete) {
        ctx.drawImage(dummyImg, 0, 0, 32, 32);
      } else {
        dummyImg.onload = function () {
          ctx.drawImage(dummyImg, 0, 0, 32, 32);
        };
      }
      return;
    }
    var item = new Item(itemId, 1);
    var frameGroup = item.getFrameGroup(FrameGroup.prototype.NONE);
    if (!frameGroup) return;
    var frame = item.getFrame();
    var pattern = item.getPattern();
    var layers = frameGroup.layers || 1;
    for (var l = 0; l < layers; l++) {
      var spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, l, 0, 0);
      var sprite = frameGroup.getSprite(spriteIndex);
      if (sprite && sprite.src) {
        ctx.drawImage(
          sprite.src,
          32 * sprite.position.x, 32 * sprite.position.y, 32, 32,
          0, 0, 32, 32
        );
      }
    }
  } catch (e) {
    console.warn("[Shop] Failed to draw sprite for item", itemId, e);
  }
};
