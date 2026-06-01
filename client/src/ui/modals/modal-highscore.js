const SKILL_LABELS = {
  experience: "Level",
  magic: "Magic",
  fist: "Fist",
  club: "Club",
  sword: "Sword",
  axe: "Axe",
  distance: "Distance",
  shielding: "Shielding",
  fishing: "Fishing"
};

const HighscoreModal = function (id) {
  Modal.call(this, id);
  this.__spriteBuffer = new SpriteBuffer(2);
  this.__currentSkill = "magic";
  this.__currentVocation = -1;
  this.__currentOrder = "desc";
  this.__currentPage = 1;
  this.__totalPages = 1;
  this.__refreshInterval = null;
};

HighscoreModal.prototype = Object.create(Modal.prototype);
HighscoreModal.prototype.constructor = HighscoreModal;

HighscoreModal.prototype.handleOpen = function () {
  this.__buildFilters();
  this.__fetchAndRender();
  this.__startAutoRefresh();
};

HighscoreModal.prototype.handleConfirm = function () {
  this.__stopAutoRefresh();
  return true;
};

HighscoreModal.prototype.__startAutoRefresh = function () {
  this.__stopAutoRefresh();
  this.__refreshInterval = setInterval(this.__fetchAndRender.bind(this), 300000);
};

HighscoreModal.prototype.__stopAutoRefresh = function () {
  if (this.__refreshInterval !== null) {
    clearInterval(this.__refreshInterval);
    this.__refreshInterval = null;
  }
};

HighscoreModal.prototype.__buildFilters = function () {
  let container = this.element.querySelector("#highscore-filters");
  if (!container) return;
  container.innerHTML = "";

  let makeGroup = function (labelText, select) {
    let group = document.createElement("div");
    group.className = "highscore-filter-group";
    let label = document.createElement("label");
    label.className = "highscore-filter-label";
    label.textContent = labelText;
    group.appendChild(label);
    group.appendChild(select);
    return group;
  };

  let vocSelect = document.createElement("select");
  vocSelect.className = "highscore-select";
  vocSelect.id = "highscore-vocation";
  let allOpt = document.createElement("option");
  allOpt.value = "-1";
  allOpt.textContent = "All";
  vocSelect.appendChild(allOpt);
  VOCATION_NAMES.forEach(function (name, i) {
    let opt = document.createElement("option");
    opt.value = i.toString();
    opt.textContent = name;
    vocSelect.appendChild(opt);
  });
  vocSelect.value = this.__currentVocation.toString();
  vocSelect.addEventListener("change", this.__onChange.bind(this));
  container.appendChild(makeGroup("Vocation", vocSelect));

  let skillSelect = document.createElement("select");
  skillSelect.className = "highscore-select";
  skillSelect.id = "highscore-skill";
  Object.keys(SKILL_LABELS).forEach(function (key) {
    if (key === "experience") return;
    let opt = document.createElement("option");
    opt.value = key;
    opt.textContent = SKILL_LABELS[key];
    skillSelect.appendChild(opt);
  });
  skillSelect.value = this.__currentSkill;
  skillSelect.addEventListener("change", this.__onChange.bind(this));
  container.appendChild(makeGroup("Skills", skillSelect));

  let orderSelect = document.createElement("select");
  orderSelect.className = "highscore-select";
  orderSelect.id = "highscore-order";
  let descOpt = document.createElement("option");
  descOpt.value = "desc";
  descOpt.textContent = "Highest";
  orderSelect.appendChild(descOpt);
  let ascOpt = document.createElement("option");
  ascOpt.value = "asc";
  ascOpt.textContent = "Lowest";
  orderSelect.appendChild(ascOpt);
  orderSelect.value = this.__currentOrder;
  orderSelect.addEventListener("change", this.__onChange.bind(this));
  container.appendChild(makeGroup("Sort", orderSelect));
};

HighscoreModal.prototype.__onChange = function () {
  this.__currentVocation = parseInt(document.getElementById("highscore-vocation").value, 10);
  this.__currentSkill = document.getElementById("highscore-skill").value;
  this.__currentOrder = document.getElementById("highscore-order").value;
  this.__currentPage = 1;
  this.__fetchAndRender();
};

HighscoreModal.prototype.__fetchAndRender = function () {
  let list = this.element.querySelector("#highscore-list");
  if (!list) return;
  list.innerHTML = "<div class='highscore-loading'>Loading...</div>";

  let offset = (this.__currentPage - 1) * 5;

  let params = new URLSearchParams({
    skill: this.__currentSkill,
    vocation: this.__currentVocation.toString(),
    order: this.__currentOrder,
    limit: "5",
    offset: offset.toString()
  });

  fetch("/api/highscores?" + params.toString())
    .then(function (res) { return res.json(); })
    .then(function (data) {
      this.__renderList(data.entries || data);
      this.__totalPages = Math.max(1, Math.ceil((data.total || 0) / 5));
      this.__renderPagination();
    }.bind(this))
    .catch(function () {
      list.innerHTML = "<div class='highscore-loading'>Failed to load highscores.</div>";
    });
};

HighscoreModal.prototype.__renderList = function (data) {
  let list = this.element.querySelector("#highscore-list");
  if (!list) return;
  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.innerHTML = "<div class='highscore-empty'>No entries found.</div>";
    return;
  }

  let self = this;

  // Header row
  let header = document.createElement("div");
  header.className = "highscore-header";
  let hRank = document.createElement("div");
  hRank.className = "highscore-rank";
  header.appendChild(hRank);
  let hAvatar = document.createElement("div");
  hAvatar.className = "highscore-header-avatar";
  header.appendChild(hAvatar);
  let hName = document.createElement("div");
  hName.className = "highscore-name";
  hName.textContent = "Name";
  header.appendChild(hName);
  let hLevel = document.createElement("div");
  hLevel.className = "highscore-level";
  hLevel.textContent = "Level";
  header.appendChild(hLevel);
  let hVoc = document.createElement("div");
  hVoc.className = "highscore-vocation";
  hVoc.textContent = "Vocation";
  header.appendChild(hVoc);
  let hSkill = document.createElement("div");
  hSkill.className = "highscore-skill";
  hSkill.textContent = SKILL_LABELS[this.__currentSkill] || "";
  header.appendChild(hSkill);
  list.appendChild(header);

  data.forEach(function (entry) {
    let row = document.createElement("div");
    row.className = "highscore-row";

    // Rank
    let rankEl = document.createElement("div");
    rankEl.className = "highscore-rank";
    rankEl.textContent = entry.rank;
    row.appendChild(rankEl);

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

    // Skill value
    let skillEl = document.createElement("div");
    skillEl.className = "highscore-skill";
    skillEl.textContent = entry.skillValue;
    row.appendChild(skillEl);

    list.appendChild(row);
  });
};

HighscoreModal.prototype.__renderPagination = function () {
  let firstBtn = this.element.querySelector("#highscore-page-first");
  let prevBtn = this.element.querySelector("#highscore-page-prev");
  let nextBtn = this.element.querySelector("#highscore-page-next");
  let lastBtn = this.element.querySelector("#highscore-page-last");

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

HighscoreModal.prototype.__goToPage = function (page) {
  if (page < 1 || page > this.__totalPages) return;
  this.__currentPage = page;
  this.__fetchAndRender();
};

HighscoreModal.prototype.__renderOutfitPreview = function (outfitData, canvasEl) {
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
    ctx.fillStyle = "#555";
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
