"use strict";

const HouseRentManager = function () {

  /*
   * Class HouseRentManager
   * Manages automatic rent collection for houses
   * Runs periodically and sends letters to players about rent payments
   */

  // Schedule the first rent check in 5 minutes after server start
  // Then every RENT_PERIOD_DAYS days thereafter
  this.__scheduleNextCheck();

}

HouseRentManager.prototype.__scheduleNextCheck = function () {

  /*
   * Function HouseRentManager.__scheduleNextCheck
   * Schedules the next rent check based on config
   */

  let rentPeriodMs = (CONFIG.HOUSE ? CONFIG.HOUSE.RENT_PERIOD_DAYS : 7) * 24 * 60 * 60 * 1000;

  gameServer.world.eventQueue.addEventMs(this.__checkRent.bind(this), rentPeriodMs);

}

HouseRentManager.prototype.__checkRent = function () {

  /*
   * Function HouseRentManager.__checkRent
   * Iterates all houses and processes rent for owned houses
   */

  gameServer.database.houses.forEach(function(house) {
    if(!house.owner || house.owner === "") return;
    if(house.boughtOutright) return;
    this.__processHouseRent(house);
  }, this);

  // Save all house data after processing
  gameServer.database.saveHouses();

  // Schedule next check
  this.__scheduleNextCheck();

}

HouseRentManager.prototype.__processHouseRent = function (house) {

  /*
   * Function HouseRentManager.__processHouseRent
   * Processes rent for a single house — 3-stage flow:
   *   1st miss: send "Rent Due", set 7d due date
   *   2nd miss: send "Final Warning", extend 7d
   *   3rd miss: evict
   */

  let rentAmount = house.tiles.length * (CONFIG.HOUSE ? CONFIG.HOUSE.PRICE_PER_SQM : 100);

  if(rentAmount <= 0) return;

  // Try to pay rent automatically from bank balance
  let paid = this.__tryPayRent(house, rentAmount);

  if(paid) {
    let msg = "Your rent of " + rentAmount + " gold for " + house.name + " has been paid.";
    this.__sendRentLetter(house.owner, "Rent Payment", msg);

    house.rentPending = false;
    house.rentDueDate = null;
    house.finalWarningSent = false;
    return;
  }

  // Stage 1: first missed payment
  if(!house.rentPending) {
    house.rentPending = true;
    house.rentDueDate = Date.now() + 7 * 24 * 60 * 60 * 1000;
    house.finalWarningSent = false;

    let msg = "Your rent of " + rentAmount + " gold for " + house.name + " is due. ";
    msg += "You have 7 days to pay, otherwise your house will be reclaimed.";
    this.__sendRentLetter(house.owner, "Rent Due", msg);
    return;
  }

  // Stage 2: already pending — check if overdue
  if(house.rentDueDate && Date.now() >= house.rentDueDate) {

    // Send final warning if not yet sent
    if(!house.finalWarningSent) {
      house.finalWarningSent = true;
      house.rentDueDate = Date.now() + 7 * 24 * 60 * 60 * 1000;

      let msg = "FINAL WARNING: Your rent of " + rentAmount + " gold for " + house.name + " is due. ";
      msg += "Pay immediately or your house will be reclaimed in 7 days.";
      this.__sendRentLetter(house.owner, "Final Rent Warning", msg);
      return;
    }

    // Stage 3: overdue — evict
    this.__evictHouse(house, rentAmount);
    return;
  }

}

HouseRentManager.prototype.__tryPayRent = function (house, rentAmount) {

  /*
   * Function HouseRentManager.__tryPayRent
   * Attempts to pay the rent from the player's bank balance
   */

  let owner = gameServer.world.creatureHandler.getPlayerByName(house.owner);

  // Try online player's bank
  if(owner !== null) {
    let balance = owner.getBankBalance();
    if(balance >= rentAmount) {
      owner.setBankBalance(balance - rentAmount);
      owner.sendCancelMessage("Your rent of " + rentAmount + " gold has been paid.");
      return true;
    }
    return false;
  }

  // Offline player - need to read their file to check bank balance
  return this.__tryPayRentOffline(house.owner, rentAmount);

}

HouseRentManager.prototype.__tryPayRentOffline = function (ownerName, rentAmount) {

  /*
   * Function HouseRentManager.__tryPayRentOffline
   * Attempts to pay rent for an offline player by reading their character file
   */

  try {
    let accountDb = process.gameServer.HTTPServer.websocketServer.accountDatabase;
    let accountsDir = accountDb.getAccountsDir();

    let entries = require("fs").readdirSync(accountsDir, { withFileTypes: true });

    for(let entry of entries) {
      if(!entry.isDirectory()) continue;

      let metaPath = require("path").join(accountsDir, entry.name, "account.json");
      if(!require("fs").existsSync(metaPath)) continue;

      let meta = JSON.parse(require("fs").readFileSync(metaPath, "utf-8"));

      for(let cn of (meta.characters || [])) {
        if(cn.toLowerCase() !== ownerName.trim().toLowerCase()) continue;

        let charPath = accountDb.__getCharacterFilePath(entry.name, cn);
        if(!require("fs").existsSync(charPath)) continue;

        let charData = JSON.parse(require("fs").readFileSync(charPath, "utf-8"));

        let balance = charData.storage && charData.storage["50001"] ? charData.storage["50001"] : 0;

        if(balance >= rentAmount) {
          if(!charData.storage) charData.storage = {};
          charData.storage["50001"] = balance - rentAmount;
          require("fs").writeFileSync(charPath, JSON.stringify(charData, null, 4));
          return true;
        }

        return false;
      }
    }
  } catch(e) {
    console.error("Error paying rent offline for", ownerName, e);
  }

  return false;

}

HouseRentManager.prototype.__evictHouse = function (house, rentAmount) {

  /*
   * Function HouseRentManager.__evictHouse
   * Evicts the owner from the house due to non-payment
   */

  let ownerName = house.owner;

  house.setOwner(null);

  gameServer.database.saveHouses();

  let msg = "Your house " + house.name + " has been reclaimed due to non-payment of " + rentAmount + " gold rent.";
  msg += " Your items have been moved to your inbox.";
  this.__sendRentLetter(ownerName, "House Reclaimed", msg);

  console.log("House " + house.name + " reclaimed from " + ownerName + " due to non-payment.");

}

HouseRentManager.prototype.__sendRentLetter = function (ownerName, title, body) {

  /*
   * Function HouseRentManager.__sendRentLetter
   * Sends a rent-related letter to a player's inbox
   */

  let letter = process.gameServer.database.createThing(2598);
  if(!letter) return;

  letter.setContent(title + "\n\n" + body + "\n\n\u2014 King Tibianus");

  let owner = gameServer.world.creatureHandler.getPlayerByName(ownerName);

  if(owner !== null) {
    owner.containerManager.depot.addFirstEmpty(letter);
    owner.sendCancelMessage("You have received mail regarding your house.");
  } else {
    // Send offline
    try {
      let MailboxHandler = requireModule("utils/mailbox-handler");
      let mh = new MailboxHandler();
      mh.writeLetter(ownerName, title + "\n\n" + body + "\n\n\u2014 King Tibianus", function(err) {
        if(err) console.error("Failed to send rent letter to", ownerName, err);
      });
    } catch(e) {
      console.warn("Could not send rent letter to offline player", ownerName);
    }
  }

}

module.exports = HouseRentManager;
