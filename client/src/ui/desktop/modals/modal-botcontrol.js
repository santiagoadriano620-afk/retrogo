const BotControlModal = function (id) {
  Modal.call(this, id);
  this.__suspects = [];
  this.__cheaters = [];
};

BotControlModal.prototype = Object.create(Modal.prototype);
BotControlModal.prototype.constructor = BotControlModal;

BotControlModal.prototype.handleOpen = function () {
  let self = this;

  document.querySelectorAll("#floater-bot-control .bot-tab").forEach(function (b) {
    b.onclick = function () { self.__switchTab(this.dataset.tab); };
  });

  this.__fetchData();
};

BotControlModal.prototype.__fetchData = function () {
  let self = this;
  let xhr = new XMLHttpRequest();
  xhr.open("GET", "/api/anticheat", true);
  xhr.onload = function () {
    try {
      let data = JSON.parse(xhr.responseText);
      self.__suspects = data.suspects || [];
      self.__cheaters = data.cheaters || [];
      self.__renderSuspects();
      self.__renderCheaters();
    } catch (e) {
      console.error("Failed to parse anticheat data:", e);
    }
  };
  xhr.onerror = function () {
    console.error("Failed to fetch anticheat data.");
  };
  xhr.send();
};

BotControlModal.prototype.__switchTab = function (tab) {
  document.querySelectorAll("#floater-bot-control .bot-tab").forEach(function (b) {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll("#floater-bot-control .bot-tab-content").forEach(function (c) {
    c.classList.toggle("active", c.id === "bot-tab-" + tab);
  });
};

BotControlModal.prototype.__renderSuspects = function () {
  let container = document.getElementById("bot-suspect-entries");
  if (!container) return;

  if (this.__suspects.length === 0) {
    container.innerHTML = "<div class='highscore-empty'>No suspects detected.</div>";
    return;
  }

  let html = "";
  this.__suspects.forEach(function (s) {
    html += "<div class='bot-entry'>";
    html += "<div><span class='bot-entry-name'>" + s.name + "</span> <span class='bot-entry-score'>(" + s.score + " violações)</span></div>";
    html += "<div class='bot-entry-actions'>";
    html += "<button class='bot-btn-confirm' onclick='BotControlModal.__confirmCheater(\"" + s.name + "\")'>Confirmar</button>";
    html += "<button class='bot-btn-dismiss' onclick='BotControlModal.__dismissSuspect(\"" + s.name + "\")'>Descartar</button>";
    html += "</div></div>";
  });
  container.innerHTML = html;
};

BotControlModal.prototype.__renderCheaters = function () {
  let container = document.getElementById("bot-cheater-entries");
  if (!container) return;

  if (this.__cheaters.length === 0) {
    container.innerHTML = "<div class='highscore-empty'>No active cheaters.</div>";
    return;
  }

  let html = "";
  this.__cheaters.forEach(function (c) {
    html += "<div class='bot-entry'>";
    html += "<div><span class='bot-entry-name bot-cheater-label'>● " + c.name + "</span></div>";
    html += "<div class='bot-entry-actions'>";
    html += "<button class='bot-btn-remove' onclick='BotControlModal.__removeCheater(\"" + c.name + "\")'>Remove Skull</button>";
    html += "</div></div>";
  });
  container.innerHTML = html;
};

BotControlModal.__confirmCheater = function (name) {
  let xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/anticheat/confirm", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      gameClient.interface.setCancelMessage(name + " marked as cheater.");
      let modal = gameClient.interface.modalManager.get("floater-bot-control");
      if (modal) modal.__fetchData();
    } else {
      gameClient.interface.setCancelMessage("Failed to confirm cheater.");
    }
  };
  xhr.send(JSON.stringify({ name: name }));
};

BotControlModal.__dismissSuspect = function (name) {
  let xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/anticheat/dismiss", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      let modal = gameClient.interface.modalManager.get("floater-bot-control");
      if (modal) modal.__fetchData();
    }
  };
  xhr.send(JSON.stringify({ name: name }));
};

BotControlModal.__removeCheater = function (name) {
  let xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/anticheat/remove", true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onload = function () {
    if (xhr.status === 200) {
      gameClient.interface.setCancelMessage(name + " cheater skull removed.");
      let modal = gameClient.interface.modalManager.get("floater-bot-control");
      if (modal) modal.__fetchData();
    } else {
      gameClient.interface.setCancelMessage("Failed to remove cheater skull.");
    }
  };
  xhr.send(JSON.stringify({ name: name }));
};
