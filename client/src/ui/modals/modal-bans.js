const BansModal = function (id) {
  Modal.call(this, id);
  this.__spriteBuffer = new SpriteBuffer(2);
  this.__currentPage = 1;
  this.__totalPages = 1;
};

BansModal.prototype = Object.create(Modal.prototype);
BansModal.prototype.constructor = BansModal;

BansModal.prototype.handleOpen = function () {
  this.__currentPage = 1;
  this.__fetchAndRender();
};

BansModal.prototype.handleConfirm = function () {
  return true;
};

BansModal.prototype.__fetchAndRender = function () {
  let list = this.element.querySelector("#bans-list");
  if (!list) return;
  list.innerHTML = "<div class='highscore-loading'>Loading...</div>";

  let offset = (this.__currentPage - 1) * 5;

  let params = new URLSearchParams({
    limit: "5",
    offset: offset.toString()
  });

  fetch("/api/bans?" + params.toString())
    .then(function (res) { return res.json(); })
    .then(function (data) {
      this.__renderList(data.entries || []);
      this.__totalPages = Math.max(1, Math.ceil((data.total || 0) / 5));
      this.__renderPagination();
    }.bind(this))
    .catch(function () {
      list.innerHTML = "<div class='highscore-loading'>Failed to load bans.</div>";
    });
};

BansModal.prototype.__renderList = function (data) {
  let list = this.element.querySelector("#bans-list");
  if (!list) return;
  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.innerHTML = "<div class='highscore-empty'>No banned players.</div>";
    return;
  }

  let self = this;

  data.forEach(function (entry) {
    let row = document.createElement("div");
    row.className = "highscore-row";

    // Avatar
    let canvasEl = document.createElement("canvas");
    canvasEl.width = 64;
    canvasEl.height = 64;
    canvasEl.style.width = "48px";
    canvasEl.style.height = "48px";
    self.__renderOutfitPreview(entry.outfit, canvasEl);
    row.appendChild(canvasEl);

    // Name
    let nameEl = document.createElement("div");
    nameEl.className = "highscore-name";
    nameEl.textContent = entry.name;
    row.appendChild(nameEl);

    // Level
    let levelEl = document.createElement("div");
    levelEl.className = "highscore-level";
    levelEl.textContent = entry.level;
    row.appendChild(levelEl);

    // Vocation
    let vocEl = document.createElement("div");
    vocEl.className = "highscore-vocation";
    let vocName = VOCATION_NAMES[entry.vocation];
    vocEl.textContent = vocName !== undefined ? vocName : "None";
    row.appendChild(vocEl);

    list.appendChild(row);
  });
};

BansModal.prototype.__renderPagination = function () {
  let firstBtn = this.element.querySelector("#bans-page-first");
  let prevBtn = this.element.querySelector("#bans-page-prev");
  let nextBtn = this.element.querySelector("#bans-page-next");
  let lastBtn = this.element.querySelector("#bans-page-last");

  if (firstBtn) {
    firstBtn.onclick = function () { this.__goToPage(1); }.bind(this);
    firstBtn.style.display = this.__currentPage > 2 ? "" : "none";
  }
  if (prevBtn) {
    prevBtn.onclick = function () { this.__goToPage(this.__currentPage - 1); }.bind(this);
    prevBtn.style.display = this.__currentPage > 1 ? "" : "none";
  }
  if (nextBtn) {
    nextBtn.onclick = function () { this.__goToPage(this.__currentPage + 1); }.bind(this);
    nextBtn.style.display = this.__currentPage < this.__totalPages ? "" : "none";
  }
  if (lastBtn) {
    lastBtn.onclick = function () { this.__goToPage(this.__totalPages); }.bind(this);
    lastBtn.style.display = this.__currentPage < this.__totalPages ? "" : "none";
  }
};

BansModal.prototype.__goToPage = function (page) {
  if (page < 1 || page > this.__totalPages) return;
  this.__currentPage = page;
  this.__fetchAndRender();
};

BansModal.prototype.__renderOutfitPreview = function (outfitData, canvasEl) {
  let ctx = canvasEl.getContext("2d", { willReadFrequently: true });
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
