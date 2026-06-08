const OracleShowPacket = requireModule("network/protocol").OracleShowPacket;

module.exports = function the_oracle() {
    this.setBaseState(baseTalkState);
    this.on("focus", player => {
        let level = player.getLevel();
        if (level >= 8 && level <= 9) {
            let vocations = [
                { id: CONST.VOCATION.KNIGHT, outfitId: 113, name: "Knight" },
                { id: CONST.VOCATION.PALADIN, outfitId: 113, name: "Paladin" },
                { id: CONST.VOCATION.SORCERER, outfitId: 113, name: "Sorcerer" },
                { id: CONST.VOCATION.DRUID, outfitId: 113, name: "Druid" }
            ];
            let towns = [
                { id: 1, name: "Thais" },
                { id: 2, name: "Carlin" },
                { id: 5, name: "Edron" },
                { id: 7, name: "Venore" },
                { id: 8, name: "Darashia" }
            ];
            player.write(new OracleShowPacket(this.npc.getId(), vocations, towns));
        } else {
            this.say("CHILD! COME BACK WHEN YOU HAVE GROWN UP!");
            this.abort();
        }
    });
    this.on("defocus", player => this.say("Goodbye, %s!".format(player.name)));
    this.on("exit", player => this.say("Come back soon!"));
    this.on("regreet", player => this.say("Yes?"));
    this.on("idle", player => this.say("Hello?"));
    this.on("busy", (focus, player) => this.privateSay(player, "Please wait, I am talking to %s.".format(focus.name)));
}

function baseTalkState(state, player, message) {
    switch (message) {
        case "trade":
            this.tradeHandler.openTradeWindow(player);
            return this.respond("Here are my offers.");
    }
}
