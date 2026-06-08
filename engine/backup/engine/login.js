"use strict";

require("./require");

const LoginServer = requireModule("auth/login-server");

function startLoginServer() {

  /*
   * Function startLoginServer
   * Starts the HTTP login server
   */

  console.log("Starting NodeJS RetroGo Open Tibia Login Server.");

  // Start
  global.loginServer = new LoginServer();
  global.loginServer.initialize();

}

if (require.main === module) {
  startLoginServer();
}

module.exports = startLoginServer;
