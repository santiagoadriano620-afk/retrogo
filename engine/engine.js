"use strict";

require("./require");

const GameServer = requireModule("core/gameserver");

function main() {

  /*
   * Function main
   * Called on startup
   */

  console.log("Starting NodeJS RetroGo Open Tibia Server");
  console.log("Creating server with version %s".format(CONFIG.SERVER.CLIENT_VERSION));
  console.log("Setting data directory to %s".format(getDataFile("")));

  // Attach the gameserver to the process and initialize
  global.gameServer = process.gameServer = new GameServer();

  // Initialize the gameserver
  gameServer.initialize();

}

if (require.main === module) {
  main();
}

module.exports = main;
