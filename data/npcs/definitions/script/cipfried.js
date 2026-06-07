"use strict";

const Condition = requireModule("combat/condition");

module.exports = function cipfried() {
    this.setBaseState(baseTalkState);
    this.on("defocus", player => this.say("Well, bye then."));
    this.on("busy", (focus, player) => this.privateSay(player, "Please wait, %s! I already talk to someone.".format(focus.name)));
}

function baseTalkState(state, player, message) {
    if (message !== "heal") return;

    const hp = player.getProperty(CONST.PROPERTIES.HEALTH);
    const maxHp = player.getProperty(CONST.PROPERTIES.HEALTH_MAX);

    if (player.hasCondition(Condition.prototype.BURNING)) {
        player.removeCondition(Condition.prototype.BURNING);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_GREEN);
        return this.respond("You are burning, %s! I will help you.".format(player.name));
    }

    if (player.hasCondition(Condition.prototype.POISONED)) {
        player.removeCondition(Condition.prototype.POISONED);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_RED);
        return this.respond("You are poisoned, %s! I will help you.".format(player.name));
    }

    if (hp < 65) {
        const newHp = Math.min(65, maxHp);
        player.setProperty(CONST.PROPERTIES.HEALTH, newHp);
        gameServer.world.sendMagicEffect(player.position, CONST.EFFECT.MAGIC.MAGIC_BLUE);
        return this.respond("You are looking really bad, %s! Let me heal your wounds.".format(player.name));
    }

    this.respond("You aren't looking really bad, %s! Sorry, I can't help you.".format(player.name));
}
