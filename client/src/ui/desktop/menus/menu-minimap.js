const MinimapMenu = function (id) {

  Menu.call(this, id);

}

MinimapMenu.prototype = Object.create(Menu.prototype);
MinimapMenu.prototype.constructor = MinimapMenu;

MinimapMenu.prototype.click = function (event) {

  let action = this.__getAction(event);
  let minimap = gameClient.renderer.minimap;

  switch (action) {
    case "add-mark":
      minimap.openAddMarkModal(this.downEvent);
      break;
  }

  return true;

}
