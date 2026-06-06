const CLIENT_VERSION = "0.0.1";
const SERVER_VERSION = "740";

function __getRefCodeFromUrl() {
  let params = new URLSearchParams(window.location.search);
  let ref = params.get("ref");
  return ref && /^[a-z0-9]{3,10}$/.test(ref) ? ref : null;
}

function __initGameClient() {

  if (window.gameClient) {
    return;
  }

  window.gameClient = new GameClient();
  window.gameClient.referralCode = __getRefCodeFromUrl();
  new ConsoleResizer();

  gameClient.database.loadGameAssets();

}

function __startGameClient() {
  __initGameClient();
}

if (document.readyState === "complete") {
  __startGameClient();
} else {
  window.onload = __startGameClient;
}

if (document.readyState === "complete" || document.readyState === "interactive") {
  document.getElementById("enter-game").disabled = true;
  if (window.__initI18n) window.__initI18n();
} else {
  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("enter-game").disabled = true;
    if (window.__initI18n) window.__initI18n();
  });
}
