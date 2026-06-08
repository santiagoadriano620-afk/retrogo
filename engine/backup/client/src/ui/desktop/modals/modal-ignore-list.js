const IgnoreListModal = function (element) {
  Modal.call(this, element);
  this.__listContainer = document.getElementById("ignore-list-container");
  this.__addButton = document.getElementById("ignore-list-add-btn");
  this.__addButton.addEventListener("click", this.__handleAdd.bind(this));
}

IgnoreListModal.prototype = Object.create(Modal.prototype);
IgnoreListModal.prototype.constructor = IgnoreListModal;

IgnoreListModal.prototype.handleOpen = function () {
  this.__renderList();
}

IgnoreListModal.prototype.__handleAdd = function () {
  let modal = gameClient.interface.modalManager.open("enter-name-modal");
  if (modal) {
    modal.setConfirmCallback(function (name) {
      if (!name) return;
      if (name === gameClient.player.name) {
        return gameClient.interface.setCancelMessage(__("modal.ignore.cannot_ignore_self"));
      }
      if (gameClient.player.ignorelist.has(name)) {
        return gameClient.interface.setCancelMessage(__("modal.ignore.already_ignored"));
      }
      gameClient.send(new IgnoreAddPacket(name));
    });
  }
}

IgnoreListModal.prototype.__renderList = function () {
  let list = gameClient.player.ignorelist.getList();
  let container = this.__listContainer;
  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = "<div class=\"ignore-list-empty\">" + __("modal.ignore.empty") + "</div>";
    return;
  }

  list.forEach(function (name) {
    let entry = document.createElement("div");
    entry.className = "ignore-list-entry";

    let nameSpan = document.createElement("span");
    nameSpan.className = "ignore-list-name";
    nameSpan.textContent = name;

    let removeBtn = document.createElement("button");
    removeBtn.className = "ignore-list-remove";
    removeBtn.textContent = __("common.remove");
    removeBtn.addEventListener("click", function () {
      gameClient.send(new IgnoreRemovePacket(name));
      gameClient.player.ignorelist.remove(name);
      this.__renderList();
    }.bind(this));

    entry.appendChild(nameSpan);
    entry.appendChild(removeBtn);
    container.appendChild(entry);
  }, this);
}
