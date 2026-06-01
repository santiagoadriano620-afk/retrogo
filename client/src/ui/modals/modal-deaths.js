const DeathsModal = function (id) {
  Modal.call(this, id);
  this.__spriteBuffer = new SpriteBuffer(2);
  this.__currentPage = 1;
  this.__totalPages = 1;
  this.__allEntries = [];
  this.__perPage = 5;
};

DeathsModal.prototype = Object.create(Modal.prototype);
DeathsModal.prototype.constructor = DeathsModal;

DeathsModal.prototype.handleOpen = function () {
  this.__currentPage = 1;
  this.__allEntries = [];
  this.__fetchAll();
};

DeathsModal.prototype.handleConfirm = function () {
  return true;
};

DeathsModal.prototype.__fetchAll = function () {
  let list = this.element.querySelector("#deaths-list");
  if (!list) return;
  list.innerHTML = "<div class='highscore-loading'>Loading...</div>";

  fetch("/api/deaths?limit=50&offset=0")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      this.__allEntries = data.entries || [];
      this.__totalPages = Math.max(1, Math.ceil(this.__allEntries.length / this.__perPage));
      this.__currentPage = 1;
      this.__renderCurrentPage();
    }.bind(this))
    .catch(function () {
      list.innerHTML = "<div class='highscore-loading'>Failed to load deaths.</div>";
    });
};

DeathsModal.prototype.__renderCurrentPage = function () {
  this.__renderList(this.__allEntries);
  this.__renderPagination();
};

DeathsModal.prototype.__renderList = function (allData) {
  let list = this.element.querySelector("#deaths-list");
  if (!list) return;
  list.innerHTML = "";

  if (!allData || allData.length === 0) {
    list.innerHTML = "<div class='highscore-empty'>No deaths recorded.</div>";
    return;
  }

  let start = (this.__currentPage - 1) * this.__perPage;
  let pageData = allData.slice(start, start + this.__perPage);
  let self = this;

  pageData.forEach(function (entry) {
    let row = document.createElement("div");
    row.className = "deaths-row";

    let avatarCell = document.createElement("div");
    avatarCell.className = "deaths-avatar";
    let canvasEl = document.createElement("canvas");
    canvasEl.width = 64;
    canvasEl.height = 64;
    canvasEl.style.width = "48px";
    canvasEl.style.height = "48px";
    self.__renderOutfitPreview(entry.outfit, canvasEl);
    avatarCell.appendChild(canvasEl);
    row.appendChild(avatarCell);

    let infoCell = document.createElement("div");
    infoCell.className = "deaths-info";

    let nameEl = document.createElement("div");
    nameEl.className = "deaths-name";
    nameEl.textContent = entry.name;
    infoCell.appendChild(nameEl);

    let killedByEl = document.createElement("div");
    killedByEl.className = "deaths-killed-by";
    killedByEl.innerHTML = "morreu para <span class='deaths-killer'>" + entry.killed_by + "</span> no level " + entry.level;
    infoCell.appendChild(killedByEl);

    let timeEl = document.createElement("div");
    timeEl.className = "deaths-time";
    let d = new Date(entry.created_at);
    let pad = function (n) { return n < 10 ? "0" + n : n; };
    timeEl.textContent = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
    infoCell.appendChild(timeEl);

    row.appendChild(infoCell);
    list.appendChild(row);
  });
};

DeathsModal.prototype.__renderPagination = function () {
  let prevBtn = this.element.querySelector("#deaths-page-prev");
  let nextBtn = this.element.querySelector("#deaths-page-next");

  if (prevBtn) {
    prevBtn.onclick = function () { this.__goToPage(this.__currentPage - 1); }.bind(this);
    prevBtn.style.display = this.__currentPage > 1 ? "" : "none";
  }
  if (nextBtn) {
    nextBtn.onclick = function () { this.__goToPage(this.__currentPage + 1); }.bind(this);
    nextBtn.style.display = this.__currentPage < this.__totalPages ? "" : "none";
  }
};

DeathsModal.prototype.__goToPage = function (page) {
  if (page < 1 || page > this.__totalPages) return;
  this.__currentPage = page;
  this.__renderCurrentPage();
};

DeathsModal.prototype.__renderOutfitPreview = function (outfitData, canvasEl) {
  let ctx = canvasEl.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);

  if (!outfitData || !outfitData.details) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  let outfit = new Outfit(outfitData);
  let outfitObject = outfit.getDataObject();

  if (!outfitObject) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  let item = outfitObject.getFrameGroup(0);
  let baseIdentifier = item.getSpriteId(0, 2, 0, 0, 0, 0, 0);

  if (baseIdentifier === 0) {
    ctx.fillStyle = "#555";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  this.__spriteBuffer.clear();
  this.__spriteBuffer.addComposedOutfit(baseIdentifier, outfit, item, 0, 2, 0, 0, 0);
  let sprite = this.__spriteBuffer.get(baseIdentifier);

  if (sprite === null) {
    ctx.fillStyle = "#666";
    ctx.fillRect(8, 8, 48, 48);
    return;
  }

  ctx.drawImage(
    sprite.src,
    32 * sprite.position.x,
    32 * sprite.position.y,
    32, 32,
    16, 16,
    32, 32
  );
};
