module.exports = function dagomir() {

    this.setBaseState(baseTalkState);

    this.on("focus", player => {
        this.say("Wha... what?? HOW DARE YOU!!?? LEAVE ME ALONE ON MY TOILET AT ONCE!");
    });

    this.on("defocus", player => {});
    this.on("exit", player => {});
    this.on("regreet", player => {});
    this.on("idle", player => {});
    this.on("busy", (focus, player) => {});

}

function baseTalkState(state, player, message) {}
