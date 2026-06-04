const HouseModal = function (id) {
  Modal.call(this, id);
  this.__data = null;
  let self = this;
  document.getElementById("house-rent-btn").addEventListener("click", function () {
    if (self.__data && self.__data.canBuy) {
      gameClient.send(new HouseBuyPacket(self.__data.houseId));
    }
    gameClient.interface.modalManager.close();
  });
  document.getElementById("house-buy-outright-btn").addEventListener("click", function () {
    if (self.__data && self.__data.canBuy) {
      gameClient.send(new HouseBuyOutrightPacket(self.__data.houseId));
    }
    gameClient.interface.modalManager.close();
  });
};
HouseModal.prototype = Object.create(Modal.prototype);
HouseModal.prototype.constructor = HouseModal;

HouseModal.prototype.handleOpen = function (options) {
  this.__data = options;

  document.getElementById("house-name-display").textContent = options.name;
  document.getElementById("house-sqm").textContent = options.sqm + " sqm";

  let pricePerSqm = options.pricePerSqm || 100;
  let rentDays = options.rentPeriodDays || 7;
  let weeklyRent = options.price || (options.sqm * pricePerSqm);
  let buyPrice = options.buyPrice || Math.floor(weeklyRent * 52 * 0.8);

  document.getElementById("house-price-per-sqm").textContent = pricePerSqm.toLocaleString() + " gp";
  document.getElementById("house-weekly-rent").textContent = weeklyRent.toLocaleString() + " gold";
  document.getElementById("house-buy-price").textContent = buyPrice.toLocaleString() + " gold";
  document.getElementById("house-rent-period").textContent = "Every " + rentDays + " days";
  document.getElementById("house-beds").textContent = options.beds || 0;

  let badge = document.getElementById("house-badge");
  if (options.guildhall) {
    badge.textContent = "Guildhall";
    badge.setAttribute("data-type", "guildhall");
  } else {
    badge.textContent = "House";
    badge.setAttribute("data-type", "house");
  }

  let rentBtn = document.getElementById("house-rent-btn");
  let buyBtn = document.getElementById("house-buy-outright-btn");
  let reason = document.getElementById("house-reason");
  if (options.canBuy) {
    rentBtn.style.display = "block";
    buyBtn.style.display = "block";
    reason.style.display = "none";
  } else {
    rentBtn.style.display = "none";
    buyBtn.style.display = "none";
    reason.style.display = "block";
    reason.textContent = options.reason || "";
  }
};

HouseModal.prototype.handleConfirm = function () {
  return true;
};

HouseModal.prototype.handleCancel = function () {
  return true;
};