module.exports = function daniel_steelsoul() {

    this.setBaseState(baseTalkState);

    this.on("focus", player => {});
    this.on("defocus", player => this.say("Goodbye, %s!".format(player.name)));
    this.on("exit", player => this.say("Come back soon!"));
    this.on("regreet", player => this.say("Yes?"));
    this.on("idle", player => this.say("Hello?"));
    this.on("busy", (focus, player) => this.privateSay(player, "Please wait, I am talking to %s.".format(focus.name)));
}

function baseTalkState(state, player, message) {
    switch (message) {
        case "guild":
        case "create":
            return handleGuildCreate.call(this, player);
    }
}

function handleGuildCreate(player) {
    let guildName = player.getStorage(CONFIG.GUILD.QUEST_STORAGE + 1);
    if (guildName !== -1) {
        return this.respond("You already lead the guild '%s'. You cannot form another.".format(guildName));
    }

    if (player.getLevel() < CONFIG.GUILD.CREATE_LEVEL) {
        return this.respond("To form a guild you must be at least level %s.".format(CONFIG.GUILD.CREATE_LEVEL));
    }

    if (CONFIG.GUILD.CREATE_PREMIUM && !player.isPremium()) {
        return this.respond("Only those blessed with a premium account may form a guild.");
    }

    let questDone = player.getStorage(CONFIG.GUILD.QUEST_STORAGE);

    if (questDone === 1) {
        this.setTalkState(awaitingGuildName);
        return this.respond("You have proven your worth. Tell me the name of the guild you wish to form.");
    }

    if (player.containerManager.equipment.removeItem(CONFIG.GUILD.PROOF_ITEM, 1)) {
        player.setStorage(CONFIG.GUILD.QUEST_STORAGE, 1);
        console.log("[GUILD] %s delivered Dragon Ham, quest completed.".format(player.name));
        this.setTalkState(awaitingGuildName);
        return this.respond("Ah, a Dragon Ham! You have proven your strength. The order of Banor's Blood accepts you. Now, tell me the name of the guild you wish to form.");
    }

    this.setTalkState(awaitingDragonHamAccept);
    return this.respond("To prove yourself worthy of leading a guild, you must bring me a Dragon Ham as a symbol of your strength. Do you accept this challenge?");
}

function awaitingDragonHamAccept(state, player, message) {
    if (message === "yes") {
        this.setBaseState(baseTalkState);
        return this.respond("Go forth and slay a dragon, brave warrior! Return to me with its ham and your guild shall be born.");
    }
    if (message === "no") {
        this.setBaseState(baseTalkState);
        return this.respond("Very well. Return when you are ready to prove yourself.");
    }
    return this.respond("Do you accept the challenge? Say 'yes' or 'no'.");
}

function awaitingGuildName(state, player, message) {
    if (message === "no" || message === "cancel" || message === "nevermind") {
        this.setBaseState(baseTalkState);
        return this.respond("Very well. Return when you are ready.");
    }

    state.pendingName = message.trim();

    if (state.pendingName.length < 3 || state.pendingName.length > 30) {
        return this.respond("A guild name must be between 3 and 30 characters. Please choose another.");
    }

    if (!/^[a-zA-Z ]+$/.test(state.pendingName)) {
        return this.respond("The name may only contain letters and spaces. Please choose another.");
    }

    if (process.gameServer.guildManager.guildExists(state.pendingName)) {
        return this.respond("A guild with that name already exists. Please choose another.");
    }

    this.setTalkState(confirmGuildCreation, state);
    return this.respond("You wish to form '%s'? Say 'yes' to confirm.".format(state.pendingName));
}

function confirmGuildCreation(state, player, message) {
    if (message === "yes") {
        let result = process.gameServer.guildManager.createGuild(state.pendingName, player);
        if (result.success) {
            this.setBaseState(baseTalkState);
            return this.respond("Congratulations! The guild '%s' has been formed. Lead with honor!".format(state.pendingName));
        } else {
            this.setBaseState(baseTalkState);
            return this.respond(result.error);
        }
    }

    if (message === "no") {
        this.setTalkState(awaitingGuildName, {});
        return this.respond("Then tell me another name for your guild.");
    }

    return this.respond("Say 'yes' to confirm or 'no' to choose another name.");
}
