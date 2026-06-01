const CharacterSelectModal = function(id) {

  Modal.call(this, id);

  this.__spriteBuffer = new SpriteBuffer(2);
  this.__pendingDeleteName = null;
  this.__currentOptions = null;
  this.__showCreateForm = false;
  this.__activeTab = "chars";

}

CharacterSelectModal.prototype = Object.create(Modal.prototype);
CharacterSelectModal.constructor = CharacterSelectModal;

CharacterSelectModal.prototype.__renderTabBar = function(list) {
  let tabBar = document.createElement("div");
  tabBar.className = "character-tab-bar";

  let charsTab = document.createElement("span");
  charsTab.className = "character-tab" + (this.__activeTab !== "referral" ? " active" : "");
  charsTab.textContent = "Character List";
  charsTab.dataset.tab = "chars";

  let refTab = document.createElement("span");
  refTab.className = "character-tab" + (this.__activeTab === "referral" ? " active" : "");
  refTab.textContent = "Referral Program";
  refTab.dataset.tab = "referral";

  tabBar.appendChild(charsTab);
  tabBar.appendChild(refTab);

  tabBar.addEventListener("click", function(e) {
    let tab = e.target.closest(".character-tab");
    if (!tab) return;
    if (tab.dataset.tab === this.__activeTab) return;
    this.__activeTab = tab.dataset.tab;
    this.handleOpen(this.__currentOptions);
  }.bind(this));

  list.appendChild(tabBar);
}

CharacterSelectModal.prototype.__renderReferralView = function(list, options) {
  let container = document.createElement("div");
  container.className = "referral-container";
  list.appendChild(container);

  let code = options.refCode || "------";
  let stats = options.refStats || { total: 0, rewarded: 0, pending: 0 };
  let levelRequired = options.refLevelRequired || 20;
  let rewardPoints = options.refRewardPoints || 10;

  let codeSection = document.createElement("div");
  codeSection.className = "referral-section";

  let codeLabel = document.createElement("div");
  codeLabel.className = "referral-code-label";
  codeLabel.textContent = "Your Referral Code";

  let codeValue = document.createElement("div");
  codeValue.className = "referral-code-value";
  codeValue.textContent = code;

  let codeHint = document.createElement("div");
  codeHint.className = "referral-code-hint";
  codeHint.textContent = "Share this link with your friends!";

  let linkInput = document.createElement("input");
  linkInput.className = "referral-link-input";
  linkInput.type = "text";
  linkInput.readOnly = true;
  let baseUrl = window.location.origin + window.location.pathname.replace(/\/+$/, "");
  linkInput.value = baseUrl + "?ref=" + code;

  let copyBtn = document.createElement("button");
  copyBtn.className = "referral-copy-btn";
  copyBtn.textContent = "Copy Link";
  copyBtn.addEventListener("click", function() {
    linkInput.select();
    document.execCommand("copy");
    copyBtn.textContent = "Copied!";
    setTimeout(function() { copyBtn.textContent = "Copy Link"; }, 2000);
  });

  codeSection.appendChild(codeLabel);
  codeSection.appendChild(codeValue);
  codeSection.appendChild(codeHint);
  codeSection.appendChild(linkInput);
  codeSection.appendChild(copyBtn);
  container.appendChild(codeSection);

  let statsSection = document.createElement("div");
  statsSection.className = "referral-section";

  let statsTitle = document.createElement("div");
  statsTitle.className = "referral-stats-title";
  statsTitle.textContent = "Referral Stats";

  let infoText = document.createElement("div");
  infoText.className = "referral-info-text";
  infoText.textContent = "Every friend who registers using your link and reaches level " + levelRequired + " earns you " + rewardPoints + " Premium Points!";

  let statsRow = document.createElement("div");
  statsRow.className = "referral-stats-row";

  let totalBox = document.createElement("div");
  totalBox.className = "referral-stat-box";
  totalBox.innerHTML = "<span class='referral-stat-value'>" + stats.total + "</span><span class='referral-stat-label'>Total Referrals</span>";

  let rewardedBox = document.createElement("div");
  rewardedBox.className = "referral-stat-box rewarded";
  rewardedBox.innerHTML = "<span class='referral-stat-value'>" + stats.rewarded + "</span><span class='referral-stat-label'>Rewarded</span>";

  let pendingBox = document.createElement("div");
  pendingBox.className = "referral-stat-box pending";
  pendingBox.innerHTML = "<span class='referral-stat-value'>" + stats.pending + "</span><span class='referral-stat-label'>Pending</span>";

  statsRow.appendChild(totalBox);
  statsRow.appendChild(rewardedBox);
  statsRow.appendChild(pendingBox);

  statsSection.appendChild(statsTitle);
  statsSection.appendChild(infoText);
  statsSection.appendChild(statsRow);
  container.appendChild(statsSection);
}

CharacterSelectModal.prototype.handleOpen = function(options) {

  this.__currentOptions = options;
  this.__showCreateForm = false;

  let list = document.getElementById("character-list");
  list.innerHTML = "";

  this.__cancelDelete();
  this.__hideCreateForm();

  this.__renderTabBar(list);

  if (this.__activeTab === "referral") {
    this.__renderReferralView(list, options);
    return;
  }

  let characters = options.characters || [];
  let token = options.token;
  let host = options.host;

  characters.forEach(function(char) {
    let entry = document.createElement("div");
    entry.className = "character-entry";

    let canvasEl = document.createElement("canvas");
    canvasEl.width = 64;
    canvasEl.height = 64;

    this.__renderOutfitPreview(char.outfit, canvasEl);

    let info = document.createElement("div");
    info.className = "character-entry-info";

    let nameEl = document.createElement("div");
    nameEl.className = "character-entry-name";
    nameEl.textContent = char.name;

    let levelEl = document.createElement("div");
    levelEl.className = "character-entry-level";
    levelEl.textContent = "Level " + char.level;

    info.appendChild(nameEl);
    info.appendChild(levelEl);

    entry.appendChild(canvasEl);
    entry.appendChild(info);

    let deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "\u2715";
    deleteBtn.title = "Remover personagem";
    deleteBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      this.__startDeleteFlow(char.name);
    }.bind(this));

    entry.appendChild(deleteBtn);

    entry.addEventListener("click", function() {
      gameClient.interface.modalManager.close("floater-characters");
      gameClient.networkManager.connectWithToken(token, host, char.name, options.xorKey);
    });

    list.appendChild(entry);
  }.bind(this));

  // Add "Create New Character" entry
  let createEntry = document.createElement("div");
  createEntry.className = "character-entry character-entry-create";
  createEntry.id = "create-character-entry";

  let iconEl = document.createElement("div");
  iconEl.className = "character-entry-create-icon";
  iconEl.textContent = "+";

  let createInfo = document.createElement("div");
  createInfo.className = "character-entry-info";

  let createNameEl = document.createElement("div");
  createNameEl.className = "character-entry-name";
  createNameEl.textContent = "Create New Character";

  let createLevelEl = document.createElement("div");
  createLevelEl.className = "character-entry-level";
  createLevelEl.textContent = "Add a new character to this account";

  createInfo.appendChild(createNameEl);
  createInfo.appendChild(createLevelEl);

  createEntry.appendChild(iconEl);
  createEntry.appendChild(createInfo);

  createEntry.addEventListener("click", function() {
    this.__toggleCreateForm();
  }.bind(this));

  list.appendChild(createEntry);

  // Add account type badge at the bottom
  let existingBadge = list.parentNode.querySelector(".account-type-badge");
  if (existingBadge) {
    existingBadge.remove();
  }
  let premiumExpiry = options.premiumExpiry || 0;
  let isPremium = premiumExpiry > Date.now();
  let badge = document.createElement("div");
  badge.className = "account-type-badge" + (isPremium ? " premium" : " free");
  let icon = document.createElement("div");
  icon.className = "account-type-icon" + (isPremium ? " premium" : " free");
  let text = document.createElement("span");
  if (isPremium) {
    let remaining = Math.max(0, Math.ceil((premiumExpiry - Date.now()) / 86400000));
    text.textContent = "Premium Account \u2014 " + remaining + " day" + (remaining !== 1 ? "s" : "") + " remaining";
  } else {
    text.textContent = "Free Account";
  }
  badge.appendChild(icon);
  badge.appendChild(text);
  list.appendChild(badge);

}

CharacterSelectModal.prototype.__toggleCreateForm = function() {

  if (this.__showCreateForm) {
    this.__hideCreateForm();
    return;
  }

  this.__showCreateForm = true;

  let createEntry = document.getElementById("create-character-entry");
  if (createEntry) {
    createEntry.style.display = "none";
  }

  let confirmArea = document.getElementById("character-confirm-area");
  confirmArea.style.display = "block";

  confirmArea.innerHTML =
    '<div class="confirm-text" style="margin-bottom:8px;">Create a new character:</div>' +
    '<input class="confirm-input" id="create-char-name" type="text" placeholder="Character name" autocomplete="off" spellcheck="false" style="width:calc(100% - 16px);margin-bottom:12px;padding:8px 8px;">' +
    '<div class="sex-selector" style="margin-bottom:12px;">' +
      '<label class="sex-radio"><input type="radio" name="create-char-sex" value="male" checked><span class="radio-circle"></span> Male</label>' +
      '<label class="sex-radio"><input type="radio" name="create-char-sex" value="female"><span class="radio-circle"></span> Female</label>' +
    '</div>' +
    '<div class="confirm-buttons">' +
      '<button class="confirm-btn-yes" id="create-char-confirm">Create</button>' +
      '<button class="confirm-btn-no" id="create-char-cancel">Cancel</button>' +
    '</div>';

  document.getElementById("create-char-confirm").addEventListener("click", this.__executeCreate.bind(this));
  document.getElementById("create-char-cancel").addEventListener("click", this.__hideCreateForm.bind(this));

  let input = document.getElementById("create-char-name");
  input.focus();
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      this.__executeCreate();
    }
    if (e.key === "Escape") {
      this.__hideCreateForm();
    }
  }.bind(this));

}

CharacterSelectModal.prototype.__hideCreateForm = function() {

  this.__showCreateForm = false;

  let confirmArea = document.getElementById("character-confirm-area");
  confirmArea.style.display = "none";
  confirmArea.innerHTML = "";

  let createEntry = document.getElementById("create-character-entry");
  if (createEntry) {
    createEntry.style.display = "flex";
  }

}

CharacterSelectModal.prototype.__executeCreate = function() {

  let nameInput = document.getElementById("create-char-name");
  let sexInput = document.querySelector('input[name="create-char-sex"]:checked');
  let options = this.__currentOptions;

  if (!nameInput || !sexInput || !options) {
    return;
  }

  let name = nameInput.value.trim().toLowerCase();
  let sex = sexInput.value;

  if (!name) {
    nameInput.style.border = "1px solid #c00";
    nameInput.focus();
    return;
  }

  if (!/^[a-z]+$/.test(name)) {
    nameInput.style.border = "1px solid #c00";
    nameInput.value = "";
    nameInput.placeholder = "Lowercase letters only!";
    nameInput.focus();
    return;
  }

  let FORBIDDEN_NAMES = [
    "admin", "administrator", "adm", "cm", "gamemaster", "gm",
    "moderator", "mod", "tutor", "seniortutor", "senior", "cipsoft", "cip",
    "caralho", "porra", "merda", "bosta", "cusao", "cusão",
    "puta", "puto", "putinha", "putinho", "vadia", "piranha",
    "arrombado", "arrombada", "babaca", "fdp",
    "filhodaputa", "filhadaputa", "filhoduma", "vaffanculo",
    "fuck", "fucker", "fucking", "shit", "shitter",
    "asshole", "bitch", "bastard", "dick", "cock",
    "cunt", "motherfucker",
    "macaco", "negrinha", "criolo", "crioulo", "denegrido",
    "branquelo", "judeu", "nazista", "hitler", "kkk",
    "nigger", "nigga", "spic", "chink", "negrama", "negroid",
  ];
  let isNameAllowed = true;
  for (let i = 0; i < FORBIDDEN_NAMES.length; i++) {
    if (name.indexOf(FORBIDDEN_NAMES[i]) !== -1) {
      isNameAllowed = false;
      break;
    }
  }
  if (!isNameAllowed) {
    nameInput.style.border = "1px solid #c00";
    nameInput.value = "";
    nameInput.placeholder = "This name is not allowed!";
    nameInput.focus();
    return;
  }

  nameInput.style.border = null;
  nameInput.disabled = true;
  document.querySelectorAll('input[name="create-char-sex"]').forEach(function(r) { r.disabled = true; });

  document.getElementById("create-char-confirm").disabled = true;
  document.getElementById("create-char-cancel").disabled = true;

  fetch("/create-character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account: options.account,
      password: options.password,
      name: name,
      sex: sex
    })
  }).then(function(resp) {
    if (resp.ok) {
      this.__refreshList(options.account, options.password);
    } else if (resp.status === 403) {
      alert("Maximum of 5 characters per account reached.");
      this.__hideCreateForm();
    } else if (resp.status === 409) {
      alert("A character with this name already exists.");
      this.__hideCreateForm();
    } else {
      alert("Failed to create character.");
      this.__hideCreateForm();
    }
  }.bind(this)).catch(function() {
    alert("Connection error.");
    this.__hideCreateForm();
  }.bind(this));

}

function __escapeHtml(str) {
  let div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

CharacterSelectModal.prototype.__startDeleteFlow = function(charName) {

  this.__pendingDeleteName = charName;

  let confirmArea = document.getElementById("character-confirm-area");
  confirmArea.style.display = "block";

  confirmArea.innerHTML =
    '<div class="confirm-text">Tem certeza que deseja remover <b>' + __escapeHtml(charName) + '</b>?</div>' +
    '<div class="confirm-buttons">' +
      '<button class="confirm-btn-yes" id="confirm-yes">Sim</button>' +
      '<button class="confirm-btn-no" id="confirm-no">N\u00e3o</button>' +
    '</div>';

  document.getElementById("confirm-yes").addEventListener("click", this.__showTypeNameStep.bind(this));
  document.getElementById("confirm-no").addEventListener("click", this.__cancelDelete.bind(this));

}

CharacterSelectModal.prototype.__showTypeNameStep = function() {

  let confirmArea = document.getElementById("character-confirm-area");
  confirmArea.innerHTML =
    '<div class="confirm-text">Digite o nome do personagem para confirmar:</div>' +
    '<input class="confirm-input" id="confirm-input" type="text" placeholder="' + __escapeHtml(this.__pendingDeleteName) + '" autocomplete="off" spellcheck="false">' +
    '<div class="confirm-buttons">' +
      '<button class="confirm-btn-delete" id="confirm-delete">Deletar</button>' +
      '<button class="confirm-btn-exit" id="confirm-exit">Sair</button>' +
    '</div>';

  document.getElementById("confirm-delete").addEventListener("click", this.__executeDelete.bind(this));
  document.getElementById("confirm-exit").addEventListener("click", this.__cancelDelete.bind(this));

  let input = document.getElementById("confirm-input");
  input.focus();
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      this.__executeDelete();
    }
    if (e.key === "Escape") {
      this.__cancelDelete();
    }
  }.bind(this));

}

CharacterSelectModal.prototype.__cancelDelete = function() {

  this.__pendingDeleteName = null;

  // Only hide if create form is not active
  if (this.__showCreateForm) {
    return;
  }

  let confirmArea = document.getElementById("character-confirm-area");
  confirmArea.style.display = "none";
  confirmArea.innerHTML = "";

}

CharacterSelectModal.prototype.__executeDelete = function() {

  let input = document.getElementById("confirm-input");

  if (!input) {
    return;
  }

  let typedName = input.value.trim();
  let expectedName = this.__pendingDeleteName;

  if (typedName.toLowerCase() !== expectedName.toLowerCase()) {
    input.style.border = "1px solid #c00";
    input.value = "";
    input.placeholder = "Nome incorreto! Digite novamente.";
    input.focus();
    return;
  }

  let options = this.__currentOptions;

  fetch("/delete-character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account: options.account,
      password: options.password,
      name: expectedName
    })
  }).then(function(resp) {
    if (resp.ok) {
      this.__refreshList(options.account, options.password);
    } else {
      alert("Erro ao remover personagem. Verifique a conta e tente novamente.");
    }
  }.bind(this)).catch(function() {
    alert("Erro de conex\u00e3o com o servidor.");
  });

}

CharacterSelectModal.prototype.__refreshList = function(account, password) {

  fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: account, password: password })
  }).then(function(resp) {
    if (!resp.ok) {
      this.close();
      return null;
    }
    return resp.json();
  }.bind(this)).then(function(data) {
    if (!data) return;
    this.handleOpen({
      characters: data.characters,
      token: data.token,
      host: data.host,
      account: account,
      password: password,
      premiumExpiry: data.premiumExpiry || 0,
      refCode: data.refCode,
      refStats: data.refStats,
      refLevelRequired: data.refLevelRequired,
      refRewardPoints: data.refRewardPoints
    });
  }.bind(this)).catch(function() {
    this.close();
  }.bind(this));

}

CharacterSelectModal.prototype.__renderOutfitPreview = function(outfitData, canvasEl) {

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

}
