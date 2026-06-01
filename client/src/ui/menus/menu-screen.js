const ScreenMenu = function(id) {

  /*
   * Class ScreenMenu
   * Wrapper for the menu that displays on the main game screen
   */

  // Inherits from menu
  Menu.call(this, id);

}

ScreenMenu.prototype = Object.create(Menu.prototype);
ScreenMenu.prototype.constructor = ScreenMenu;

ScreenMenu.prototype.click = function(event) {

  /*
   * Function ScreenMenu.click
   * Callback fired specially for the ScreenMenu after a button is clicked
   */

  // Get the selected world object
  let object = Mouse.prototype.getWorldObject(this.downEvent);
  let tile = object && object.which;
  let creature = tile && tile.getTopCreature ? tile.getTopCreature() : null;

  // Take action depending on the button
  let action = this.__getAction(event);

  switch(action) {
    case "look":
      gameClient.mouse.look(object);
      break;
    case "use":
      gameClient.mouse.use(object);
      break;
    case "change-outfit":
      gameClient.interface.modalManager.open("outfit-modal");
      break;
    case "party-invite":
      if (creature) {
        gameClient.send(new PartyInvitePacket(creature.getName()));
      }
      break;
    case "party-join":
      if (gameClient.player && gameClient.player.__pendingPartyInvite) {
        gameClient.send(new PartyJoinPacket(gameClient.player.__pendingPartyInvite));
        gameClient.player.__pendingPartyInvite = null;
      }
      break;
    case "party-leave":
      gameClient.send(new PartyLeavePacket());
      break;
    case "party-kick":
      if (creature) {
        gameClient.send(new PartyKickPacket(creature.getName()));
      }
      break;
    case "party-pass":
      if (creature) {
        gameClient.send(new PartyPassLeadershipPacket(creature.getName()));
      }
      break;
    case "trade":
      if (creature && creature.type === 0 && creature !== gameClient.player) {
        gameClient.send(new TradeRequestPacketClient(creature.id));
      }
      break;
    case "accept-trade":
      gameClient.send(new TradeAcceptPacketClient());
      break;
    case "browse-market":
      if (creature && creature.type === 0 && creature !== gameClient.player) {
        gameClient.send(new MarketRequestViewPacket(creature.id));
      }
      break;
    case "start-market":
      gameClient.interface.modalManager.open("market-modal");
      let modal = gameClient.interface.modalManager.get("market-modal");
      if (modal) {
        modal.openAsSetup();
      }
      break;
    case "attack":
      if (creature) {
        if (creature.type === 0 && creature !== gameClient.player) {
          if (gameClient.interface.fightModeSelector && gameClient.interface.fightModeSelector.isSafeFight()) {
            gameClient.player.setTarget(creature);
            gameClient.send(new TargetPacket(creature.id));
          } else {
            gameClient.interface.setCancelMessage("You may not attack this player, turn safe fight on.");
          }
        } else {
          gameClient.player.setTarget(creature);
          gameClient.send(new TargetPacket(creature.id));
        }
      }
      break;
  }

  // Return true to close the menu after clicking
  return true;

}