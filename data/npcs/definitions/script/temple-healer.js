"use strict";

const Condition = requireModule("combat/condition");

module.exports = function templeHealer() {
    this.setBaseState(baseTalkState);

    this.on("focus", player => {});
    this.on("defocus", player => this.say("Goodbye, %s!".format(player.name)));
    this.on("exit", player => this.say("Come back soon!"));
    this.on("regreet", player => this.say("Yes?"));
    this.on("idle", player => this.say("Hello?"));
    this.on("busy", (focus, player) => this.privateSay(player, "Please wait, I am talking to %s.".format(focus.name)));
}

function baseTalkState(state, player, message) {
    if (message === "heal") return handleHeal(this, player);
    if (message === "trade") {
        this.tradeHandler.openTradeWindow(player);
        return this.respond("Here are my offers.");
    }
}

function handleHeal(ctx, player) {
    const hp = player.getProperty(CONST.PROPERTIES.HEALTH);
    const maxHp = player.getProperty(CONST.PROPERTIES.HEALTH_MAX);

    if (player.hasCondition(Condition.prototype.BURNING)) {
        player.removeCondition(Condition.prototype.BURNING);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
        return ctx.respond("You are burning, %s! I will help you.".format(player.name));
    }

    if (player.hasCondition(Condition.prototype.POISONED)) {
        player.removeCondition(Condition.prototype.POISONED);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_RED);
        return ctx.respond("You are poisoned, %s! I will help you.".format(player.name));
    }

    if (hp < 65) {
        const newHp = Math.min(65, maxHp);
        player.setProperty(CONST.PROPERTIES.HEALTH, newHp);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
        return ctx.respond("You are looking really bad, %s! Let me heal your wounds.".format(player.name));
    }

    ctx.respond("You aren't looking that bad. Sorry, I can't help you.");
}
