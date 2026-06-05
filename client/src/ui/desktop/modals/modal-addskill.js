const AdminAddSkillModal = function (id) {
  Modal.call(this, id);
  this.__result = null;
};

AdminAddSkillModal.prototype = Object.create(Modal.prototype);
AdminAddSkillModal.prototype.constructor = AdminAddSkillModal;

AdminAddSkillModal.prototype.handleOpen = function () {
  document.getElementById("addskill-error").style.display = "none";
  document.getElementById("addskill-value").value = "20";
  document.getElementById("addskill-playername").value = "";
  // Re-check level
  document.querySelectorAll("#addskill-skills input[type=checkbox]").forEach(function (cb) {
    cb.checked = cb.value === "level";
  });
  var self = this;
  var confirmBtn = document.getElementById("addskill-confirm");
  confirmBtn.onclick = function () {
    self.__submit();
  };
  // Enter key in player name triggers submit
  document.getElementById("addskill-playername").onkeydown = function (e) {
    if (e.key === "Enter") self.__submit();
  };
};

AdminAddSkillModal.prototype.__submit = function () {
  var errorEl = document.getElementById("addskill-error");
  try {
    var selected = [];
    document.querySelectorAll("#addskill-skills input[type=checkbox]:checked").forEach(function (cb) {
      selected.push(cb.value);
    });
    if (selected.length === 0) {
      errorEl.textContent = "Select at least one skill.";
      errorEl.style.display = "block";
      return;
    }
    var value = parseInt(document.getElementById("addskill-value").value);
    if (isNaN(value) || value < 1) {
      errorEl.textContent = "Enter a valid value.";
      errorEl.style.display = "block";
      return;
    }
    var playerName = document.getElementById("addskill-playername").value.trim();
    if (!playerName) {
      errorEl.textContent = "Enter a player name.";
      errorEl.style.display = "block";
      return;
    }
    errorEl.style.display = "none";
    gameClient.send(new AdminAddSkillSubmitPacket(playerName, selected, value));
    gameClient.interface.modalManager.close();
  } catch (e) {
    errorEl.textContent = "Error: " + (e.message || e);
    errorEl.style.display = "block";
    console.error("[ADMIN_ADD_SKILL]", e);
  }
};

AdminAddSkillModal.prototype.handleConfirm = function () {
  return true;
};

AdminAddSkillModal.prototype.handleCancel = function () {
  return true;
};
