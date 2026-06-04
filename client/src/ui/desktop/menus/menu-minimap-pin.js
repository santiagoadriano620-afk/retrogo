const MinimapPinMenu = function (id) {

  Menu.call(this, id);

}

MinimapPinMenu.prototype = Object.create(Menu.prototype);
MinimapPinMenu.prototype.constructor = MinimapPinMenu;

MinimapPinMenu.prototype.click = function (event) {

  let action = this.__getAction(event);
  let minimap = gameClient.renderer.minimap;

  switch (action) {
    case "edit-mark":
      minimap.openEditMarkModal();
      break;
    case "remove-mark":
      minimap.removeSelectedMark();
      break;
  }

  return true;

}
