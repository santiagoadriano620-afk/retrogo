const VOCATION_NAMES = ["None", "Knight", "Paladin", "Sorcerer", "Druid", "Elite Knight", "Royal Paladin", "Master Sorcerer", "Elder Druid", "Admin"];

const GuildModal = function(id) {
  Modal.call(this, id);
  this.__guildData = null;
  this.__spriteBuffer = new SpriteBuffer(2);

  let self = this;
  Array.from(document.querySelectorAll("#guild-tabs .guild-tab")).forEach(function (tab) {
    tab.addEventListener("click", function () {
      self.__activateTab(this.getAttribute("data-tab"));
    });
  });
}

GuildModal.prototype = Object.create(Modal.prototype);
GuildModal.prototype.constructor = GuildModal;

GuildModal.prototype.handleOpen = function () {
  this.__guildData = null;
  this.__showInvitesView();
  gameClient.send(new GuildRequestInfoPacket());
}

GuildModal.prototype.handleConfirm = function () {
  return true;
}

GuildModal.prototype.updateData = function (data) {
  this.__guildData = data;

  // If player is NOT in a guild, show invites view (no tabs)
  if (!data || data.error || data.deleted) {
    this.__showInvitesView();
    return;
  }

  // Player is in a guild — show the normal tabs view
  this.__showTabsView();
  this.__activateTab("info");
}

GuildModal.prototype.__isInGuild = function () {
  let d = this.__guildData;
  return d && !d.error && !d.deleted;
}

GuildModal.prototype.__showInvitesView = function () {
  // Hide tabs
  let tabs = document.getElementById("guild-tabs");
  if (tabs) tabs.style.display = "none";

  let content = document.getElementById("guild-content");
  content.innerHTML = "";

  // Title
  let title = document.createElement("div");
  title.className = "guild-invites-title";
  title.textContent = "Invites";
  content.appendChild(title);

  // Invites list
  let list = document.createElement("div");
  list.className = "guild-invites-list";
  let invites = this.__guildData && this.__guildData.invites;
  if (invites && invites.length > 0) {
    invites.forEach(function (inv) {
      let row = document.createElement("div");
      row.className = "guild-invite-row";

      let info = document.createElement("span");
      info.className = "guild-invite-info";
      info.textContent = inv.inviterName + " invited you to " + inv.guildName;
      row.appendChild(info);

      list.appendChild(row);
    });
  } else {
    list.classList.add("guild-invites-empty");
    let msg = document.createElement("span");
    msg.className = "guild-invites-msg";
    msg.textContent = "There is no guild invite yet.";
    list.appendChild(msg);
  }
  content.appendChild(list);
}

GuildModal.prototype.__showTabsView = function () {
  let tabs = document.getElementById("guild-tabs");
  if (tabs) tabs.style.display = "flex";
}

GuildModal.prototype.__activateTab = function (tabName) {
  let tabs = document.querySelectorAll("#guild-tabs .guild-tab");
  tabs.forEach(function (t) {
    t.classList.toggle("active", t.getAttribute("data-tab") === tabName);
  });

  let self = this;
  let content = document.getElementById("guild-content");
  content.innerHTML = "";

  if (!self.__isInGuild()) {
    self.__showInvitesView();
    return;
  }

  switch (tabName) {
    case "info": self.__renderInfo(content); break;
    case "members": self.__renderMembers(content); break;
    case "bank": self.__renderBank(content); break;
    case "manage": self.__renderManage(content); break;
    case "wars": self.__renderWars(content); break;
  }
}

GuildModal.prototype.__renderInfo = function (container) {
  let d = this.__guildData;
  let online = d.members ? d.members.filter(function (m) { return m.online; }).length : 0;
  let total = d.members ? d.members.length : 0;

  let rows = [
    { label: "Name", value: d.name || "Unknown" },
    { label: "Leader", value: d.leader || "Unknown" },
    { label: "Your Rank", value: d.myRank ? d.myRank.capitalize() : "Unknown" },
    { label: "Members Online", value: online + " / " + total, extraClass: "guild-online-count" },
    { label: "Bank Balance", value: (d.bank || 0).toLocaleString() + " gp" },
    { label: "Wars", value: (d.wars ? d.wars.length : 0) + " active" }
  ];

  let self = this;
  rows.forEach(function (row) {
    let div = document.createElement("div");
    div.className = "guild-info-row";

    let label = document.createElement("span");
    label.className = "guild-info-label";
    label.textContent = row.label;

    let val = document.createElement("span");
    val.className = row.extraClass || "guild-info-value";
    val.textContent = row.value;

    div.appendChild(label);
    div.appendChild(val);
    container.appendChild(div);
  });
}

GuildModal.prototype.__getVocationName = function (v) {
  return VOCATION_NAMES[v] || "None";
};

GuildModal.prototype.__renderOutfitPreview = function (outfitData, canvasEl) {
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
  ctx.drawImage(sprite.src, 32 * sprite.position.x, 32 * sprite.position.y, 32, 32, 16, 16, 32, 32);
};

GuildModal.prototype.__renderMembers = function (container) {
  let d = this.__guildData;
  let members = d.members || [];
  let self = this;

  function rankOrder(r) {
    if (r === "leader") return 0;
    if (r === "vice") return 1;
    return 2;
  }

  members.sort(function (a, b) {
    return rankOrder(a.rank) - rankOrder(b.rank);
  });

  members.forEach(function (m) {
    let div = document.createElement("div");
    div.className = "guild-member-row";

    let canvasEl = document.createElement("canvas");
    canvasEl.width = 64;
    canvasEl.height = 64;
    canvasEl.style.width = "48px";
    canvasEl.style.height = "48px";
    self.__renderOutfitPreview(m.outfit, canvasEl);
    div.appendChild(canvasEl);

    let info = document.createElement("div");
    info.className = "guild-member-info";

    let nameRow = document.createElement("div");
    nameRow.className = "guild-member-name";
    nameRow.textContent = m.name;
    if (m.rank === "leader") {
      let badge = document.createElement("span");
      badge.className = "guild-leader-badge";
      badge.textContent = " (L)";
      nameRow.appendChild(badge);
    }
    info.appendChild(nameRow);

    let levelVocation = document.createElement("div");
    levelVocation.className = "guild-member-level";
    levelVocation.textContent = "Level " + (m.level || 1) + " - " + self.__getVocationName(m.vocation);
    info.appendChild(levelVocation);

    div.appendChild(info);

    let right = document.createElement("div");
    right.className = "guild-member-right";

    let rankSpan = document.createElement("div");
    rankSpan.className = "guild-member-rank";
    rankSpan.textContent = m.rank.capitalize();
    right.appendChild(rankSpan);

    let statusSpan = document.createElement("div");
    statusSpan.className = m.online ? "guild-member-online" : "guild-member-offline";
    statusSpan.textContent = m.online ? "Online" : "Offline";
    right.appendChild(statusSpan);

    div.appendChild(right);
    container.appendChild(div);
  });
}

GuildModal.prototype.__renderBank = function (container) {
  let d = this.__guildData;
  let self = this;

  let balanceRow = document.createElement("div");
  balanceRow.className = "guild-bank-row";
  let balLabel = document.createElement("span");
  balLabel.className = "guild-info-label";
  balLabel.textContent = "Balance";
  let balVal = document.createElement("span");
  balVal.className = "guild-bank-balance";
  balVal.textContent = (d.bank || 0).toLocaleString() + " gp";
  balanceRow.appendChild(balLabel);
  balanceRow.appendChild(balVal);
  container.appendChild(balanceRow);

  if (d.myRank) {
    let depositRow = document.createElement("div");
    depositRow.className = "guild-bank-row";

    let depLabel = document.createElement("span");
    depLabel.className = "guild-info-label";
    depLabel.textContent = "Deposit:";
    depositRow.appendChild(depLabel);

    let depInput = document.createElement("input");
    depInput.type = "number";
    depInput.className = "guild-bank-input";
    depInput.id = "guild-deposit-input";
    depInput.value = "1000";
    depInput.min = "1";
    depositRow.appendChild(depInput);

    let depBtn = document.createElement("button");
    depBtn.className = "guild-bank-btn";
    depBtn.textContent = "Deposit";
    depBtn.addEventListener("click", function () {
      let amt = parseInt(document.getElementById("guild-deposit-input").value, 10);
      if (isNaN(amt) || amt <= 0) return;
      gameClient.send(new GuildDepositPacket(amt));
    });
    depositRow.appendChild(depBtn);
    container.appendChild(depositRow);

    if (d.myRank === "leader") {
      let withdrawRow = document.createElement("div");
      withdrawRow.className = "guild-bank-row";

      let wdLabel = document.createElement("span");
      wdLabel.className = "guild-info-label";
      wdLabel.textContent = "Withdraw:";
      withdrawRow.appendChild(wdLabel);

      let wdInput = document.createElement("input");
      wdInput.type = "number";
      wdInput.className = "guild-bank-input";
      wdInput.id = "guild-withdraw-input";
      wdInput.value = "1000";
      wdInput.min = "1";
      withdrawRow.appendChild(wdInput);

      let wdBtn = document.createElement("button");
      wdBtn.className = "guild-bank-btn";
      wdBtn.textContent = "Withdraw";
      wdBtn.addEventListener("click", function () {
        let amt = parseInt(document.getElementById("guild-withdraw-input").value, 10);
        if (isNaN(amt) || amt <= 0) return;
        gameClient.send(new GuildWithdrawPacket(amt));
      });
      withdrawRow.appendChild(wdBtn);
      container.appendChild(withdrawRow);
    }
  }
}

GuildModal.prototype.__renderWars = function (container) {
  let d = this.__guildData;
  let wars = d.wars || [];

  if (wars.length === 0) {
    let p = document.createElement("p");
    p.className = "guild-noguild";
    p.textContent = "This guild is not at war.";
    container.appendChild(p);
    return;
  }

  wars.forEach(function (w) {
    let div = document.createElement("div");
    div.className = "guild-war-row";

    let nameSpan = document.createElement("span");
    nameSpan.className = "guild-war-enemy";
    nameSpan.textContent = w.enemyName;
    div.appendChild(nameSpan);

    let dateSpan = document.createElement("span");
    dateSpan.className = "guild-war-date";
    let d2 = new Date(w.declaredAt);
    dateSpan.textContent = d2.toLocaleDateString();
    div.appendChild(dateSpan);

    container.appendChild(div);
  });
}

GuildModal.prototype.__renderManage = function (container) {
  let d = this.__guildData;
  let self = this;

  if (d.myRank !== "leader") {
    let p = document.createElement("p");
    p.className = "guild-noguild";
    p.textContent = "Only the guild leader can manage the guild.";
    container.appendChild(p);
    return;
  }

  // Invite Member
  let inviteSection = document.createElement("div");
  inviteSection.className = "guild-manage-section";
  let inviteTitle = document.createElement("h4");
  inviteTitle.textContent = "Invite Member";
  inviteSection.appendChild(inviteTitle);
  let inviteRow = document.createElement("div");
  inviteRow.className = "guild-manage-row";
  let inviteInput = document.createElement("input");
  inviteInput.type = "text";
  inviteInput.className = "guild-manage-input";
  inviteInput.id = "guild-invite-input";
  inviteInput.placeholder = "Player name...";
  inviteRow.appendChild(inviteInput);
  let inviteBtn = document.createElement("button");
  inviteBtn.className = "guild-manage-btn";
  inviteBtn.textContent = "Invite";
  inviteBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-invite-input").value.trim();
    if (!name) return;
    gameClient.send(new GuildInvitePacket(name));
  });
  inviteRow.appendChild(inviteBtn);
  inviteSection.appendChild(inviteRow);
  container.appendChild(inviteSection);

  // Custom Title
  let titleSection = document.createElement("div");
  titleSection.className = "guild-manage-section";
  let titleTitle = document.createElement("h4");
  titleTitle.textContent = "Custom Title";
  titleSection.appendChild(titleTitle);
  let titleRow = document.createElement("div");
  titleRow.className = "guild-manage-row";
  let titleNameInput = document.createElement("input");
  titleNameInput.type = "text";
  titleNameInput.className = "guild-manage-input";
  titleNameInput.id = "guild-title-name-input";
  titleNameInput.placeholder = "Player name...";
  titleRow.appendChild(titleNameInput);
  let titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "guild-manage-input";
  titleInput.id = "guild-title-input";
  titleInput.placeholder = "Title...";
  titleRow.appendChild(titleInput);
  let titleBtn = document.createElement("button");
  titleBtn.className = "guild-manage-btn";
  titleBtn.textContent = "Set";
  titleBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-title-name-input").value.trim();
    let title = document.getElementById("guild-title-input").value.trim();
    if (!name || !title) return;
    gameClient.send(new GuildSetTitlePacket(name, title));
  });
  titleRow.appendChild(titleBtn);
  titleSection.appendChild(titleRow);
  container.appendChild(titleSection);

  // Transfer Leadership
  let transferSection = document.createElement("div");
  transferSection.className = "guild-manage-section";
  let transferTitle = document.createElement("h4");
  transferTitle.textContent = "Transfer Leadership";
  transferSection.appendChild(transferTitle);
  let transferRow = document.createElement("div");
  transferRow.className = "guild-manage-row";
  let transferSelect = document.createElement("select");
  transferSelect.className = "guild-manage-input";
  transferSelect.id = "guild-transfer-select";
  let members = d.members || [];
  members.forEach(function (m) {
    if (m.rank === "leader") return;
    let opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = m.name;
    transferSelect.appendChild(opt);
  });
  transferRow.appendChild(transferSelect);
  let transferBtn = document.createElement("button");
  transferBtn.className = "guild-manage-btn danger";
  transferBtn.textContent = "Transfer";
  transferBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-transfer-select").value;
    if (!name) return;
    if (confirm("Transfer leadership to " + name + "?")) {
      gameClient.send(new GuildSetRankPacket(name, 0));
    }
  });
  transferRow.appendChild(transferBtn);
  transferSection.appendChild(transferRow);
  container.appendChild(transferSection);

  // Change Rank
  let rankSection = document.createElement("div");
  rankSection.className = "guild-manage-section";
  let rankTitle = document.createElement("h4");
  rankTitle.textContent = "Change Rank";
  rankSection.appendChild(rankTitle);
  let rankRow = document.createElement("div");
  rankRow.className = "guild-manage-row";
  let rankNameInput = document.createElement("input");
  rankNameInput.type = "text";
  rankNameInput.className = "guild-manage-input";
  rankNameInput.id = "guild-rank-name-input";
  rankNameInput.placeholder = "Player name...";
  rankRow.appendChild(rankNameInput);
  let rankSelect = document.createElement("select");
  rankSelect.className = "guild-manage-input";
  rankSelect.id = "guild-rank-select";
  rankSelect.style.flex = "0 0 80px";
  let opt1 = document.createElement("option");
  opt1.value = "1";
  opt1.textContent = "Vice";
  let opt2 = document.createElement("option");
  opt2.value = "2";
  opt2.textContent = "Member";
  rankSelect.appendChild(opt1);
  rankSelect.appendChild(opt2);
  rankRow.appendChild(rankSelect);
  let rankBtn = document.createElement("button");
  rankBtn.className = "guild-manage-btn";
  rankBtn.textContent = "Set Rank";
  rankBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-rank-name-input").value.trim();
    let rankV = parseInt(document.getElementById("guild-rank-select").value, 10);
    if (!name) return;
    gameClient.send(new GuildSetRankPacket(name, rankV));
  });
  rankRow.appendChild(rankBtn);
  rankSection.appendChild(rankRow);
  container.appendChild(rankSection);

  // Remove Member
  let kickSection = document.createElement("div");
  kickSection.className = "guild-manage-section";
  let kickTitle = document.createElement("h4");
  kickTitle.textContent = "Remove Member";
  kickSection.appendChild(kickTitle);
  let kickRow = document.createElement("div");
  kickRow.className = "guild-manage-row";
  let kickInput = document.createElement("input");
  kickInput.type = "text";
  kickInput.className = "guild-manage-input";
  kickInput.id = "guild-kick-input";
  kickInput.placeholder = "Player name...";
  kickRow.appendChild(kickInput);
  let kickBtn = document.createElement("button");
  kickBtn.className = "guild-manage-btn danger";
  kickBtn.textContent = "Remove";
  kickBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-kick-input").value.trim();
    if (!name) return;
    gameClient.send(new GuildRemoveMemberPacket(name));
  });
  kickRow.appendChild(kickBtn);
  kickSection.appendChild(kickRow);
  container.appendChild(kickSection);

  // Rename Guild
  let renameSection = document.createElement("div");
  renameSection.className = "guild-manage-section";
  let renameTitle = document.createElement("h4");
  renameTitle.textContent = "Rename Guild";
  renameSection.appendChild(renameTitle);
  let renameRow = document.createElement("div");
  renameRow.className = "guild-manage-row";
  let renameInput = document.createElement("input");
  renameInput.type = "text";
  renameInput.className = "guild-manage-input";
  renameInput.id = "guild-rename-input";
  renameInput.placeholder = "New guild name...";
  renameRow.appendChild(renameInput);
  let renameBtn = document.createElement("button");
  renameBtn.className = "guild-manage-btn";
  renameBtn.textContent = "Rename";
  renameBtn.addEventListener("click", function () {
    let newName = document.getElementById("guild-rename-input").value.trim();
    if (!newName) return;
    gameClient.send(new GuildRenamePacket(newName));
  });
  renameRow.appendChild(renameBtn);
  renameSection.appendChild(renameRow);
  container.appendChild(renameSection);

  // Declare War
  let warSection = document.createElement("div");
  warSection.className = "guild-manage-section";
  let warTitle = document.createElement("h4");
  warTitle.textContent = "Declare War";
  warSection.appendChild(warTitle);
  let warRow = document.createElement("div");
  warRow.className = "guild-manage-row";
  let warInput = document.createElement("input");
  warInput.type = "text";
  warInput.className = "guild-manage-input";
  warInput.id = "guild-war-input";
  warInput.placeholder = "Enemy guild name...";
  warRow.appendChild(warInput);
  let warBtn = document.createElement("button");
  warBtn.className = "guild-manage-btn";
  warBtn.textContent = "Declare War";
  warBtn.addEventListener("click", function () {
    let name = document.getElementById("guild-war-input").value.trim();
    if (!name) return;
    gameClient.send(new GuildDeclareWarPacket(name));
  });
  warRow.appendChild(warBtn);
  warSection.appendChild(warRow);
  container.appendChild(warSection);

  // Delete Guild
  let delSection = document.createElement("div");
  delSection.className = "guild-manage-section";
  let delTitle = document.createElement("h4");
  delTitle.textContent = "Delete Guild";
  delSection.appendChild(delTitle);
  let delRow = document.createElement("div");
  delRow.className = "guild-manage-row";
  let delBtn = document.createElement("button");
  delBtn.className = "guild-manage-btn danger";
  delBtn.textContent = "Delete Guild";
  delBtn.style.width = "100%";
  delBtn.addEventListener("click", function () {
    if (confirm("Are you sure you want to delete this guild? This cannot be undone!")) {
      gameClient.send(new GuildDeletePacket());
    }
  });
  delRow.appendChild(delBtn);
  delSection.appendChild(delRow);
  container.appendChild(delSection);
}
