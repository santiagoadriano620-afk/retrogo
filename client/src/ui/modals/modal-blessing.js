const BLESSING_DATA = [
  { name: "Wisdom of Solitude", icon: 1 },
  { name: "Spark of the Phoenix", icon: 2 },
  { name: "Fire of the Suns", icon: 3 },
  { name: "Spiritual Shielding", icon: 4 },
  { name: "Embrace of Tibia", icon: 5 }
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
  header.textContent = "You have " + data.count + " of 5 active blessings";
  container.appendChild(header);

  let hr = document.createElement("hr");
  hr.className = "blessing-summary-divider";
  container.appendChild(hr);

  let rows = [
    { label: "XP/Skill Reduction:", value: data.xpReduction + "%" },
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
      let ppPrice = self.__getBlessingPPPrice();

      let goldOpt = document.createElement("div");
      goldOpt.className = "blessing-currency-opt selected";
      goldOpt.textContent = goldPrice.toLocaleString() + " gp";
      goldOpt.addEventListener("click", function () {
        slot.querySelectorAll(".blessing-currency-opt").forEach(function (el) {
          el.classList.remove("selected");
        });
        goldOpt.classList.add("selected");
        buyBtn._currency = 0;
      });
      slot.appendChild(goldOpt);

      let ppOpt = document.createElement("div");
      ppOpt.className = "blessing-currency-opt";
      ppOpt.textContent = ppPrice + " PP";
      ppOpt.addEventListener("click", function () {
        slot.querySelectorAll(".blessing-currency-opt").forEach(function (el) {
          el.classList.remove("selected");
        });
        ppOpt.classList.add("selected");
        buyBtn._currency = 1;
      });
      slot.appendChild(ppOpt);

      let buyBtn = document.createElement("button");
      buyBtn.className = "blessing-buy-btn";
      buyBtn.textContent = "Buy";
      buyBtn._currency = 0;
      if (!isPremium) {
        buyBtn.disabled = true;
        buyBtn.title = "Premium account required";
      }
      buyBtn.addEventListener("click", function () {
        buyBtn.disabled = true;
        buyBtn.textContent = "...";
        gameClient.send(new BlessingBuyPacket(i, buyBtn._currency));
      });
      slot.appendChild(buyBtn);
    }

    container.appendChild(slot);
  });

  this.__renderSummary();
}
