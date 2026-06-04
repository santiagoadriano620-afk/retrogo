const HouseManageModal = function (id) {
  Modal.call(this, id);
  this.__data = null;
  this.__spriteBuffer = new SpriteBuffer(2);

  document.getElementById("hm-invite-btn").addEventListener("click", function () {
    var input = document.getElementById("hm-invite-input");
    var name = input.value.trim();
    if (name) {
      gameClient.send(new HouseInvitePacket(name));
      input.value = "";
    }
  });

  document.getElementById("hm-sell-btn").addEventListener("click", function () {
    var input = document.getElementById("hm-sell-input");
    var name = input.value.trim();
    if (name) {
      gameClient.send(new HouseSellPacket(name));
      input.value = "";
    }
  });

  document.getElementById("hm-rent-btn").addEventListener("click", function () {
    var price = parseInt(document.getElementById("hm-rent-input").value) || 0;
    gameClient.send(new HouseSetRentPacket(price));
  });

  document.getElementById("hm-listing-btn").addEventListener("click", function () {
    var price = parseInt(document.getElementById("hm-listing-input").value) || 0;
    gameClient.send(new HouseSetListingPacket(price));
  });
};

HouseManageModal.prototype = Object.create(Modal.prototype);
HouseManageModal.prototype.constructor = HouseManageModal;

HouseManageModal.prototype.__setSection = function (id, show) {
  var el = document.getElementById(id);
  if (el) el.style.display = show ? "" : "none";
};

HouseManageModal.prototype.handleOpen = function (options) {
  this.__data = options;

  document.getElementById("hm-player-name").textContent = gameClient.player ? gameClient.player.name : options.owner;
  document.getElementById("hm-house-name").textContent = options.name;
  document.getElementById("hm-house-sqm").textContent = options.sqm + " sqm";

  var badge = document.getElementById("hm-badge");
  if (options.guildhall) {
    badge.textContent = "Guildhall";
    badge.style.color = "#ffd700";
  } else {
    badge.textContent = "House";
    badge.style.color = "#00ff88";
  }

  var tenureBadge = document.getElementById("hm-tenure-badge");
  if (options.boughtOutright) {
    tenureBadge.textContent = "Purchased";
    tenureBadge.className = "hm-tenure-badge hm-tenure-purchased";
  } else {
    tenureBadge.textContent = "Rented";
    tenureBadge.className = "hm-tenure-badge hm-tenure-rented";
  }

  var isBoughtOutright = options.boughtOutright;
  var isForRent = options.forRent;

  this.__setSection("hm-section-sell", isBoughtOutright && !isForRent);
  this.__setSection("hm-sep-sell", isBoughtOutright && !isForRent);
  this.__setSection("hm-section-rent", isBoughtOutright && !isForRent);
  this.__setSection("hm-sep-rent", isBoughtOutright && !isForRent);
  this.__setSection("hm-section-listing", isBoughtOutright && !isForRent);
  this.__setSection("hm-sep-listing", isBoughtOutright && !isForRent);

  if (isForRent && options.renterName) {
    document.getElementById("hm-rented-info-text").textContent = options.renterName;
    this.__setSection("hm-section-rented-info", true);
    this.__setSection("hm-sep-rented", true);
  } else {
    this.__setSection("hm-section-rented-info", false);
    this.__setSection("hm-sep-rented", false);
  }

  this.__drawOutfit(document.getElementById("hm-avatar"));
  this.__refreshGuestList(options.invited || []);
};

HouseManageModal.prototype.__drawOutfit = function (canvas) {
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);

  var player = gameClient ? gameClient.player : null;
  if (!player || !player.outfit) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  var outfit = new Outfit(player.outfit);
  var outfitObject = outfit.getDataObject();
  if (!outfitObject) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  var item = outfitObject.getFrameGroup(0);
  var baseIdentifier = item.getSpriteId(0, 2, 0, 0, 0, 0, 0);
  if (baseIdentifier === 0) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  this.__spriteBuffer.clear();
  this.__spriteBuffer.addComposedOutfit(baseIdentifier, outfit, item, 0, 2, 0, 0, 0);
  var sprite = this.__spriteBuffer.get(baseIdentifier);
  if (sprite === null) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  ctx.drawImage(sprite.src, 32 * sprite.position.x, 32 * sprite.position.y, 32, 32, 16, 16, 32, 32);
};

HouseManageModal.prototype.__refreshGuestList = function (invited) {
  var list = document.getElementById("hm-guest-list");
  list.innerHTML = "";

  if (!invited || invited.length === 0) {
    var empty = document.createElement("div");
    empty.className = "hm-guest-empty";
    empty.textContent = "No invited guests.";
    list.appendChild(empty);
    return;
  }

  invited.forEach(function (name) {
    var row = document.createElement("div");
    row.className = "hm-guest-row";

    var nameEl = document.createElement("span");
    nameEl.textContent = name;
    row.appendChild(nameEl);

    var removeBtn = document.createElement("button");
    removeBtn.className = "btn-botao hm-remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", function () {
      gameClient.send(new HouseRemoveGuestPacket(name));
    });
    row.appendChild(removeBtn);

    list.appendChild(row);
  });
};

HouseManageModal.prototype.handleRender = function () {
  if (this.__data && gameClient && gameClient.player && gameClient.player.outfit) {
    this.__drawOutfit(document.getElementById("hm-avatar"));
  }
};

HouseManageModal.prototype.handleConfirm = function () {
  return true;
};

HouseManageModal.prototype.handleCancel = function () {
  return true;
};