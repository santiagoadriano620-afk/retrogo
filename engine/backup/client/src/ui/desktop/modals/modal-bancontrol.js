const BanControlModal = function (id) {
  Modal.call(this, id);
  this.__spriteBuffer = new SpriteBuffer(2);
  this.__currentPage = 1;
  this.__totalPages = 1;
  this.__currentTab = "now";
  this.__selectedName = null;
  this.__debounceTimer = null;
};

BanControlModal.prototype = Object.create(Modal.prototype);
BanControlModal.prototype.constructor = BanControlModal;

BanControlModal.prototype.handleOpen = function () {
  this.__currentPage = 1;
  this.__totalPages = 1;
  this.__selectedName = null;

  let self = this;

  document.querySelectorAll("#floater-ban-control .ban-tab").forEach(function (b) {
    b.onclick = function () { self.__switchTab(this.dataset.tab); };
  });

  let banBtn = document.getElementById("ban-execute-btn");
  if (banBtn) banBtn.onclick = function () { self.__executeBan(); };

  let unbanBtn = document.getElementById("ban-unban-btn");
  if (unbanBtn) unbanBtn.onclick = function () { self.__executeUnban(); };

  let editSaveBtn = document.getElementById("ban-edit-save-btn");
  if (editSaveBtn) editSaveBtn.onclick = function () { self.__saveEditBan(); };

  let editCancelBtn = document.getElementById("ban-edit-cancel-btn");
  if (editCancelBtn) editCancelBtn.onclick = function () {
    document.getElementById("ban-edit-popup").style.display = "none";
  };

  this.__switchTab("now");
};

BanControlModal.prototype.handleConfirm = function () {
  return true;
};

BanControlModal.prototype.__switchTab = function (tab) {
  this.__currentTab = tab;
  this.__currentPage = 1;

  document.querySelectorAll("#floater-ban-control .ban-tab").forEach(function (b) {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  document.querySelectorAll("#floater-ban-control .ban-tab-content").forEach(function (c) {
    c.classList.toggle("active", c.id === "ban-tab-" + tab);
  });

  if (tab === "now") this.__initTabNow();
  else if (tab === "list") this.__fetchBanList();
  else if (tab === "history") this.__fetchBanHistory();
};

BanControlModal.prototype.__initTabNow = function () {
  this.__currentPage = 1;
  let input = document.getElementById("ban-search-input");
  if (!input) return;
  input.value = "";
  input.addEventListener("input", function () {
    if (this.__debounceTimer) clearTimeout(this.__debounceTimer);
    this.__debounceTimer = setTimeout(function () {
      this.__searchCharacters(input.value);
    }.bind(this), 200);
  }.bind(this));
  document.getElementById("ban-search-results").innerHTML = "";
  document.getElementById("ban-detail").style.display = "none";
  this.__selectedName = null;
};

BanControlModal.prototype.__searchCharacters = function (query) {
  let resultsEl = document.getElementById("ban-search-results");
  if (!resultsEl) return;

  if (query.length < 2) {
    resultsEl.innerHTML = "";
    return;
  }

  fetch("/api/bans/search?q=" + encodeURIComponent(query))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      resultsEl.innerHTML = "";
      (data.results || []).forEach(function (entry) {
        let row = document.createElement("div");
        row.className = "ban-search-row";
        row.dataset.name = entry.name;
        row.addEventListener("click", function () {
          this.__selectCharacter(entry);
        }.bind(this));

        let canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        canvas.style.width = "24px";
        canvas.style.height = "24px";
        this.__renderOutfitPreview(entry.outfit, canvas);
        row.appendChild(canvas);

        let nameEl = document.createElement("span");
        nameEl.className = "ban-search-name";
        nameEl.textContent = entry.name;
        row.appendChild(nameEl);

        let infoEl = document.createElement("span");
        infoEl.className = "ban-search-info";
        infoEl.textContent = __("modal.ban_control.level", entry.level) + " " + (VOCATION_NAMES[entry.vocation] || "");
        row.appendChild(infoEl);

        resultsEl.appendChild(row);
      }.bind(this));
    }.bind(this))
    .catch(function () {});
};

BanControlModal.prototype.__selectCharacter = function (entry) {
  this.__selectedName = entry.name;
  let detail = document.getElementById("ban-detail");
  detail.style.display = "block";
  document.getElementById("ban-detail-name").textContent = entry.name;
  document.getElementById("ban-detail-level").textContent = __("modal.ban_control.level", entry.level);
  document.getElementById("ban-detail-vocation").textContent = VOCATION_NAMES[entry.vocation] || __("modal.guild.unknown");
  this.__renderOutfitPreview(entry.outfit, document.getElementById("ban-detail-outfit"));
  document.getElementById("ban-days").value = "7";
  document.getElementById("ban-reason").value = "";

  document.querySelectorAll(".ban-search-row").forEach(function (r) {
    r.classList.toggle("selected", r.dataset.name === entry.name);
  });
};

BanControlModal.prototype.__executeBan = function () {
  let name = this.__selectedName;
  if (!name) return;
  let days = parseInt(document.getElementById("ban-days").value, 10) || 0;
  let reason = document.getElementById("ban-reason").value;

  fetch("/api/bans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ban", name: name, days: days, reason: reason, banned_by: "Admin" })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        gameClient.interface.consoleHandler.sendSystemMessage(name + " has been banned.");
        this.__switchTab("now");
      } else {
        gameClient.interface.consoleHandler.sendSystemMessage("Ban failed: " + (data.error || "unknown error"));
      }
    }.bind(this))
    .catch(function () { gameClient.interface.consoleHandler.sendSystemMessage("Ban request failed."); });
};

BanControlModal.prototype.__executeUnban = function () {
  let name = this.__selectedName;
  if (!name) return;

  fetch("/api/bans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unban", name: name })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        gameClient.interface.consoleHandler.sendSystemMessage(name + " has been unbanned.");
        this.__selectedName = null;
        document.getElementById("ban-detail").style.display = "none";
        this.__switchTab("list");
      } else {
        gameClient.interface.consoleHandler.sendSystemMessage("Unban failed: " + (data.error || "unknown error"));
      }
    }.bind(this))
    .catch(function () { gameClient.interface.consoleHandler.sendSystemMessage("Unban request failed."); });
};

BanControlModal.prototype.__fetchBanList = function () {
  let offset = (this.__currentPage - 1) * 5;
  let listEl = document.getElementById("ban-list-entries");
  if (!listEl) return;
  listEl.innerHTML = "<div class='highscore-loading'>" + __("common.loading") + "</div>";

  fetch("/api/bans/list?limit=5&offset=" + offset)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      listEl.innerHTML = "";
      let entries = data.entries || [];
      this.__totalPages = Math.max(1, Math.ceil((data.total || 0) / 5));

      if (entries.length === 0) {
        listEl.innerHTML = "<div class='highscore-empty'>" + __("modal.ban_control.no_active") + "</div>";
        return;
      }

      entries.forEach(function (entry) {
        let row = document.createElement("div");
        row.className = "ban-list-row";
        row.dataset.name = entry.character_name;

        let nameEl = document.createElement("div");
        nameEl.className = "ban-list-name";
        nameEl.textContent = entry.character_name;
        row.appendChild(nameEl);

        let daysEl = document.createElement("div");
        daysEl.className = "ban-list-days";
        daysEl.textContent = entry.days > 0 ? entry.days + "d" : __("modal.ban_control.permanent");
        row.appendChild(daysEl);

        let reasonEl = document.createElement("div");
        reasonEl.className = "ban-list-reason";
        reasonEl.textContent = entry.reason || "-";
        row.appendChild(reasonEl);

        let actionsEl = document.createElement("div");
        actionsEl.className = "ban-list-actions";

        let editBtn = document.createElement("button");
        editBtn.className = "btn-botao ban-action-btn";
        editBtn.textContent = __("modal.ban_control.edit");
        editBtn.addEventListener("click", function () { this.__editBan(entry); }.bind(this));
        actionsEl.appendChild(editBtn);

        let removeBtn = document.createElement("button");
        removeBtn.className = "btn-botao ban-action-btn";
        removeBtn.textContent = __("common.remove");
        removeBtn.addEventListener("click", function () { this.__removeBan(entry.character_name); }.bind(this));
        actionsEl.appendChild(removeBtn);

        row.appendChild(actionsEl);
        listEl.appendChild(row);
      }.bind(this));

      this.__renderBanPagination("ban");
    }.bind(this))
    .catch(function () { listEl.innerHTML = "<div class='highscore-loading'>" + __("modal.ban_control.failed_load") + "</div>"; });
};

BanControlModal.prototype.__editBan = function (entry) {
  document.getElementById("ban-edit-name").textContent = entry.character_name;
  document.getElementById("ban-edit-days").value = entry.days || 0;
  document.getElementById("ban-edit-reason").value = entry.reason || "";
  document.getElementById("ban-edit-popup").style.display = "block";
  document.getElementById("ban-edit-popup").dataset.name = entry.character_name;
};

BanControlModal.prototype.__saveEditBan = function () {
  let name = document.getElementById("ban-edit-popup").dataset.name;
  let days = parseInt(document.getElementById("ban-edit-days").value, 10) || 0;
  let reason = document.getElementById("ban-edit-reason").value;

  fetch("/api/bans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update", name: name, days: days, reason: reason })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        document.getElementById("ban-edit-popup").style.display = "none";
        gameClient.interface.consoleHandler.sendSystemMessage("Ban updated for " + name);
        this.__fetchBanList();
      } else {
        gameClient.interface.consoleHandler.sendSystemMessage("Update failed: " + (data.error || "unknown error"));
      }
    }.bind(this))
    .catch(function () { gameClient.interface.consoleHandler.sendSystemMessage("Update request failed."); });
};

BanControlModal.prototype.__removeBan = function (name) {
  fetch("/api/bans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unban", name: name })
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success) {
        gameClient.interface.consoleHandler.sendSystemMessage(name + " has been unbanned.");
        this.__fetchBanList();
      } else {
        gameClient.interface.consoleHandler.sendSystemMessage("Unban failed: " + (data.error || "unknown error"));
      }
    }.bind(this))
    .catch(function () { gameClient.interface.consoleHandler.sendSystemMessage("Unban request failed."); });
};

BanControlModal.prototype.__fetchBanHistory = function () {
  let offset = (this.__currentPage - 1) * 5;
  let listEl = document.getElementById("ban-history-entries");
  if (!listEl) return;
  listEl.innerHTML = "<div class='highscore-loading'>" + __("common.loading") + "</div>";

  fetch("/api/bans/history?limit=5&offset=" + offset)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      listEl.innerHTML = "";
      let entries = data.entries || [];
      this.__totalPages = Math.max(1, Math.ceil((data.total || 0) / 5));

      if (entries.length === 0) {
        listEl.innerHTML = "<div class='highscore-empty'>" + __("modal.ban_control.no_history") + "</div>";
        return;
      }

      entries.forEach(function (entry) {
        let row = document.createElement("div");
        row.className = "ban-history-row";

        let nameEl = document.createElement("div");
        nameEl.className = "ban-history-name";
        nameEl.textContent = entry.character_name;
        row.appendChild(nameEl);

        let byEl = document.createElement("div");
        byEl.className = "ban-history-by";
        byEl.textContent = entry.banned_by || "-";
        row.appendChild(byEl);

        let daysEl = document.createElement("div");
        daysEl.className = "ban-history-days";
        daysEl.textContent = entry.days > 0 ? entry.days + "d" : __("modal.ban_control.permanent");
        row.appendChild(daysEl);

        let reasonEl = document.createElement("div");
        reasonEl.className = "ban-history-reason";
        reasonEl.textContent = entry.reason || "-";
        row.appendChild(reasonEl);

        let statusEl = document.createElement("div");
        statusEl.className = "ban-history-status";
        statusEl.textContent = entry.active ? __("modal.ban_control.active") : __("modal.ban_control.removed");
        row.appendChild(statusEl);

        listEl.appendChild(row);
      }.bind(this));

      this.__renderBanPagination("history");
    }.bind(this))
    .catch(function () { listEl.innerHTML = "<div class='highscore-loading'>" + __("modal.ban_control.history_failed") + "</div>"; });
};

BanControlModal.prototype.__renderBanPagination = function (prefix) {
  ["first", "prev", "next", "last"].forEach(function (name) {
    let btn = document.getElementById("ban-" + prefix + "-" + name);
    if (!btn) return;
    btn.onclick = function () {
      if (name === "first") this.__currentPage = 1;
      else if (name === "prev") this.__currentPage = Math.max(1, this.__currentPage - 1);
      else if (name === "next") this.__currentPage = Math.min(this.__totalPages, this.__currentPage + 1);
      else if (name === "last") this.__currentPage = this.__totalPages;
      if (this.__currentTab === "list") this.__fetchBanList();
      else if (this.__currentTab === "history") this.__fetchBanHistory();
    }.bind(this);
    btn.style.display = (
      (name === "first" && this.__currentPage > 2) ||
      (name === "prev" && this.__currentPage > 1) ||
      (name === "next" && this.__currentPage < this.__totalPages) ||
      (name === "last" && this.__currentPage < this.__totalPages)
    ) ? "" : "none";
  }.bind(this));
};

BanControlModal.prototype.__renderOutfitPreview = function (outfitData, canvasEl) {
  let ctx = canvasEl.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (!outfitData || !outfitData.details) {
    ctx.fillStyle = "#555";
    ctx.fillRect(canvasEl.width / 2 - 12, canvasEl.height / 2 - 12, 24, 24);
    return;
  }

  let outfit = new Outfit(outfitData);
  let outfitObject = outfit.getDataObject();
  if (!outfitObject) {
    ctx.fillStyle = "#555";
    ctx.fillRect(canvasEl.width / 2 - 12, canvasEl.height / 2 - 12, 24, 24);
    return;
  }

  let item = outfitObject.getFrameGroup(0);
  let baseIdentifier = item.getSpriteId(0, 2, 0, 0, 0, 0, 0);
  if (baseIdentifier === 0) {
    ctx.fillStyle = "#555";
    ctx.fillRect(canvasEl.width / 2 - 12, canvasEl.height / 2 - 12, 24, 24);
    return;
  }

  this.__spriteBuffer.clear();
  this.__spriteBuffer.addComposedOutfit(baseIdentifier, outfit, item, 0, 2, 0, 0, 0);
  let sprite = this.__spriteBuffer.get(baseIdentifier);

  if (sprite === null) {
    ctx.fillStyle = "#666";
    ctx.fillRect(canvasEl.width / 2 - 12, canvasEl.height / 2 - 12, 24, 24);
    return;
  }

  let ratio = canvasEl.width / 64;
  ctx.drawImage(
    sprite.src,
    32 * sprite.position.x,
    32 * sprite.position.y,
    32, 32,
    (canvasEl.width - 32 * ratio) / 2,
    (canvasEl.height - 32 * ratio) / 2,
    32 * ratio,
    32 * ratio
  );
};
