const coinUtils = require("./coin-utils");

module.exports = function eva() {
    this.setBaseState(coinUtils.baseTalkState);
    this.on("focus", player => {});
    this.on("defocus", player => this.say("Goodbye, %s!".format(player.name)));
    this.on("exit", player => this.say("Come back soon!"));
    this.on("regreet", player => this.say("Yes?"));
    this.on("idle", player => this.say("Hello?"));
    this.on("busy", (focus, player) => this.privateSay(player, "Please wait, I am talking to %s.".format(focus.name)));
};
