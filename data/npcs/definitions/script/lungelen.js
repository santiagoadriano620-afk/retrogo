module.exports = function lungelen() {

    this.setBaseState(baseTalkState);

    this.on("focus", player => {
        this.say("Please don't disturb me, I am very busy in my recent researches. Have a nice day!");
    });

    this.on("defocus", player => {});
    this.on("exit", player => {});
    this.on("regreet", player => {});
    this.on("idle", player => {});
    this.on("busy", (focus, player) => {});

}

function baseTalkState(state, player, message) {}
