const BLESSING_DATA = [
  { name: __("modal.blessing.wisdom"), icon: 1 },
  { name: __("modal.blessing.spark"), icon: 2 },
  { name: __("modal.blessing.fire"), icon: 3 },
  { name: __("modal.blessing.winds"), icon: 4 },
  { name: __("modal.blessing.water"), icon: 5 }
];

const BLESSING_CONFIG = {
  XP_REDUCTION: [0, 8, 16, 24, 32, 40],
  XP_REDUCTION_PROMO: [0, 38, 46, 54, 62, 70],
};

const BlessingModal = function(id) {
  Modal.call(this, id);
}

BlessingModal.prototype = Object.create(Modal.prototype);
BlessingModal.prototype.constructor = BlessingModal;

BlessingModal.prototype.handleOpen = function () {
  this.__render();
}

BlessingModal.prototype.handleConfirm = function () {
  return true;
}

function getBlessingPrice(level) {
  if (level <= 30) return 2000;
  if (level < 120) return 200 * (level - 20);
  return 20000 + 75 * (level - 120);
}

function getBlessingPPPrice(level) {
  return Math.max(1, Math.floor(getBlessingPrice(level) / 2000));
}

BlessingModal.prototype.__getPlayerLevel = function () {
  return gameClient.player ? (gameClient.player.skills ? gameClient.player.skills.level : 1) : 1;
}

BlessingModal.prototype.__getBlessingPrice = function () {
  return getBlessingPrice(this.__getPlayerLevel());
}

BlessingModal.prototype.__getBlessingPPPrice = function () {
  return getBlessingPPPrice(this.__getPlayerLevel());
}

BlessingModal.prototype.__getBlessingCount = function () {
  let mask = gameClient.player ? gameClient.player.blessingBitmask : 0;
  let count = 0;
  for (let i = 0; i < 5; i++) {
    if (mask & (1 << i)) count++;
  }
  return count;
}

BlessingModal.prototype.__getProtectionData = function () {
  let count = this.__getBlessingCount();
  let isPremium = gameClient.player ? gameClient.player.isPremium : false;

  let xpReduction = isPremium
    ? BLESSING_CONFIG.XP_REDUCTION_PROMO[count]
    : BLESSING_CONFIG.XP_REDUCTION[count];

  return {
    count: count,
    isPremium: isPremium,
    xpReduction: xpReduction,
  };
}

BlessingModal.prototype.__renderSummary = function () {
  let container = document.getElementById("blessing-summary");
  container.innerHTML = "";
  let data = this.__getProtectionData();

  let header = document.createElement("div");
  header.className = "blessing-summary-header";
  header.textContent = __n("modal.blessing.count", data.count);
  container.appendChild(header);

  let hr = document.createElement("hr");
  hr.className = "blessing-summary-divider";
  container.appendChild(hr);

  let rows = [
    { label: __("modal.blessing.xp_reduction"), value: data.xpReduction + "%" },
  ];

  rows.forEach(function (row) {
    let r = document.createElement("div");
    r.className = "blessing-summary-row";

    let label = document.createElement("span");
    label.className = "blessing-summary-label";
    label.textContent = row.label;

    let value = document.createElement("span");
    value.className = "blessing-summary-value";
    if (row.highlight) value.classList.add("blessing-summary-highlight");
    value.textContent = row.value;

    r.appendChild(label);
    r.appendChild(value);
    container.appendChild(r);
  });
}

BlessingModal.prototype.__render = function () {
  let container = document.getElementById("blessing-slots");
  container.innerHTML = "";
  let mask = gameClient.player ? gameClient.player.blessingBitmask : 0;
  let isPremium = gameClient.player ? gameClient.player.isPremium : false;

  let self = this;
  BLESSING_DATA.forEach(function (bless, i) {
    let owned = !!(mask & (1 << i));
    let slot = document.createElement("div");
    slot.className = "blessing-slot" + (owned ? " owned" : "");

    let icon = document.createElement("img");
    icon.className = "blessing-icon";
    icon.src = "/images/game/blessing/" + (owned ? bless.icon + "_on.png" : bless.icon + ".png");
    slot.appendChild(icon);

    let name = document.createElement("div");
    name.className = "blessing-name";
    name.textContent = bless.name;
    slot.appendChild(name);

    if (!owned) {
      let goldPrice = self.__getBlessingPrice();

      let goldPriceDiv = document.createElement("div");
      goldPriceDiv.className = "blessing-gold-price";
      goldPriceDiv.textContent = goldPrice.toLocaleString() + " gp";
      slot.appendChild(goldPriceDiv);

      let buyBtn = document.createElement("button");
      buyBtn.className = "blessing-buy-btn";
      buyBtn.textContent = __("common.buy");
      if (!isPremium) {
        buyBtn.disabled = true;
        buyBtn.title = "Premium account required";
      }
      buyBtn.addEventListener("click", function () {
        buyBtn.disabled = true;
        buyBtn.textContent = "...";
        gameClient.send(new BlessingBuyPacket(i, 0));
      });
      slot.appendChild(buyBtn);
    }

    container.appendChild(slot);
  });

  this.__renderTree();

  let premiumMsg = document.getElementById("blessing-premium-msg");
  if (premiumMsg) {
    premiumMsg.style.display = isPremium ? "none" : "block";
  }

  this.__renderSummary();
}

BlessingModal.prototype.__renderTree = function () {
  let totalGold = this.__getBlessingPrice() * 5;
  let totalPP = Math.floor(totalGold / 10000);
  let container = document.getElementById("blessing-slots");
  let mask = gameClient.player ? gameClient.player.blessingBitmask : 0;

  let tree = document.createElement("div");
  tree.className = "blessing-tree";
  tree.style.gridColumn = "1 / -1";

  let stemsRow = document.createElement("div");
  stemsRow.className = "blessing-tree-stems";
  for (let i = 0; i < 5; i++) {
    let col = document.createElement("div");
    col.className = "blessing-tree-stem-col";
    let stem = document.createElement("div");
    stem.className = "blessing-tree-stem";
    col.appendChild(stem);
    stemsRow.appendChild(col);
  }
  tree.appendChild(stemsRow);

  let dropLine = document.createElement("div");
  dropLine.className = "blessing-tree-drop";
  tree.appendChild(dropLine);

  let price = document.createElement("div");
  price.className = "blessing-tree-price";
  let allOwned = (mask & 0x1F) === 0x1F;
  price.textContent = allOwned ? "0 PP" : totalPP + " PP";
  tree.appendChild(price);

  container.appendChild(tree);
};
