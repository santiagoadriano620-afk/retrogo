const FightModeSelector = function () {

    this.currentFightMode = 1;
    this.currentChaseMode = 0;
    this.__safeFight = false;

    this.container = document.getElementById("fight-mode-selector");

    if (!this.container) {
        console.warn("FightModeSelector: Container not found");
        return;
    }

    this.fightButtons = {
        offensive: this.container.querySelector('[data-mode="offensive"]'),
        balanced: this.container.querySelector('[data-mode="balanced"]'),
        defensive: this.container.querySelector('[data-mode="defensive"]')
    };

    this.chaseButtons = {
        stand: this.container.querySelector('[data-chase="stand"]'),
        chase: this.container.querySelector('[data-chase="chase"]')
    };

    this.safeFightBtn = this.container.querySelector('[data-mode="safefight"]');

    if (this.fightButtons.offensive) {
        this.fightButtons.offensive.addEventListener("click", this.setFightMode.bind(this, 0));
    }
    if (this.fightButtons.balanced) {
        this.fightButtons.balanced.addEventListener("click", this.setFightMode.bind(this, 1));
    }
    if (this.fightButtons.defensive) {
        this.fightButtons.defensive.addEventListener("click", this.setFightMode.bind(this, 2));
    }

    if (this.chaseButtons.stand) {
        this.chaseButtons.stand.addEventListener("click", this.setChaseMode.bind(this, 0));
    }
    if (this.chaseButtons.chase) {
        this.chaseButtons.chase.addEventListener("click", this.setChaseMode.bind(this, 1));
    }

    if (this.safeFightBtn) {
        this.safeFightBtn.addEventListener("click", this.toggleSafeFight.bind(this));
    }

    this.__updateFightVisualState();
    this.__updateChaseVisualState();
    this.__updateSafeFightVisualState();
};

FightModeSelector.prototype.setFightMode = function (mode) {
    if (this.currentFightMode === mode) return;
    this.currentFightMode = mode;
    gameClient.send(new FightModePacket(mode));
    this.__updateFightVisualState();
};

FightModeSelector.prototype.setChaseMode = function (mode) {
    if (this.currentChaseMode === mode) return;
    this.currentChaseMode = mode;
    gameClient.send(new ChaseModePacket(mode));
    this.__updateChaseVisualState();
};

FightModeSelector.prototype.toggleSafeFight = function () {
    this.__safeFight = !this.__safeFight;
    this.__updateSafeFightVisualState();
};

FightModeSelector.prototype.isSafeFight = function () {
    return this.__safeFight;
};

FightModeSelector.prototype.__updateFightVisualState = function () {
    Object.values(this.fightButtons).forEach(function (button) {
        if (button) button.classList.remove("active");
    });
    switch (this.currentFightMode) {
        case 0:
            if (this.fightButtons.offensive) this.fightButtons.offensive.classList.add("active");
            break;
        case 1:
            if (this.fightButtons.balanced) this.fightButtons.balanced.classList.add("active");
            break;
        case 2:
            if (this.fightButtons.defensive) this.fightButtons.defensive.classList.add("active");
            break;
    }
};

FightModeSelector.prototype.__updateChaseVisualState = function () {
    Object.values(this.chaseButtons).forEach(function (button) {
        if (button) button.classList.remove("active");
    });
    switch (this.currentChaseMode) {
        case 0:
            if (this.chaseButtons.stand) this.chaseButtons.stand.classList.add("active");
            break;
        case 1:
            if (this.chaseButtons.chase) this.chaseButtons.chase.classList.add("active");
            break;
    }
};

FightModeSelector.prototype.__updateSafeFightVisualState = function () {
    if (!this.safeFightBtn) return;
    if (this.__safeFight) {
        this.safeFightBtn.classList.add("active");
    } else {
        this.safeFightBtn.classList.remove("active");
    }
};
