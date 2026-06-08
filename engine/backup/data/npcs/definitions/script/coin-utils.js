var CURRENCY = { GOLD_COIN: 2148, PLATINUM_COIN: 2152, CRYSTAL_COIN: 2160 };

function giveGold(player, amount) {
    if (amount <= 0) return true;
    let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (!backpack) return false;
    let crystalCoins = Math.floor(amount / 10000);
    amount = amount % 10000;
    let platinumCoins = Math.floor(amount / 100);
    amount = amount % 100;
    let goldCoins = amount;
    if (!placeCoins(backpack, CURRENCY.CRYSTAL_COIN, crystalCoins)) return false;
    if (!placeCoins(backpack, CURRENCY.PLATINUM_COIN, platinumCoins)) return false;
    if (!placeCoins(backpack, CURRENCY.GOLD_COIN, goldCoins)) return false;
    return true;
}

function giveSpecificCoins(player, itemId, count) {
    if (count <= 0) return true;
    let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (!backpack) return false;
    return placeCoins(backpack, itemId, count);
}

function placeCoins(containerItem, itemId, count) {
    if (count <= 0) return true;
    const MAX = 100;

    count = fillPartialStacks(containerItem, itemId, count, MAX);
    if (count <= 0) return true;

    while (count > 0) {
        let stackSize = Math.min(count, MAX);
        let thing = process.gameServer.database.createThing(itemId);
        thing.setCount(stackSize);
        if (!addToEmptySlot(containerItem, thing)) return false;
        count -= stackSize;
    }
    return true;
}

function fillPartialStacks(containerItem, itemId, count, max) {
    let base = containerItem.container || containerItem;
    for (let i = 0; i < base.__slots.length && count > 0; i++) {
        let slot = base.__slots[i];
        if (slot !== null && slot.isStackable && slot.isStackable() && slot.id === itemId && slot.count < max) {
            let canAdd = max - slot.count;
            let toAdd = Math.min(canAdd, count);
            let addPart = process.gameServer.database.createThing(itemId);
            addPart.setCount(toAdd);
            base.addThing(addPart, i);
            count -= toAdd;
        } else if (slot !== null && slot.isContainer && slot.isContainer()) {
            count = fillPartialStacks(slot, itemId, count, max);
        }
    }
    return count;
}

function addToEmptySlot(containerItem, thing) {
    let base = containerItem.container || containerItem;
    for (let i = 0; i < base.__slots.length; i++) {
        if (base.__slots[i] === null) {
            base.addThing(thing, i);
            return true;
        }
    }
    for (let i = 0; i < base.__slots.length; i++) {
        let slot = base.__slots[i];
        if (slot !== null && slot.isContainer && slot.isContainer()) {
            if (addToEmptySlot(slot, thing)) return true;
        }
    }
    return false;
}

function canHoldValue(player, amount) {
    let crystalCoins = Math.floor(amount / 10000);
    let remaining = amount % 10000;
    let platinumCoins = Math.floor(remaining / 100);
    let goldCoins = remaining % 100;
    if (!canHoldSpecificCoins(player, CURRENCY.CRYSTAL_COIN, crystalCoins)) return false;
    if (!canHoldSpecificCoins(player, CURRENCY.PLATINUM_COIN, platinumCoins)) return false;
    if (!canHoldSpecificCoins(player, CURRENCY.GOLD_COIN, goldCoins)) return false;
    return true;
}

function canHoldSpecificCoins(player, itemId, count) {
    if (count <= 0) return true;
    const MAX_STACK = 100;
    let backpack = player.containerManager.equipment.peekIndex(CONST.EQUIPMENT.BACKPACK);
    if (!backpack) return false;
    let freeSlots = 0;
    let partialSpace = 0;
    function countSpace(item) {
        let base = item.container || item;
        for (let i = 0; i < base.__slots.length; i++) {
            let slot = base.__slots[i];
            if (slot === null) {
                freeSlots++;
            } else if (slot.isContainer && slot.isContainer()) {
                countSpace(slot);
            } else if (slot.isStackable && slot.isStackable() && slot.id === itemId && slot.count < MAX_STACK) {
                partialSpace += MAX_STACK - slot.count;
            }
        }
    }
    countSpace(backpack);
    return partialSpace + freeSlots * MAX_STACK >= count;
}

function getPhysicalCount(player, itemId) {
    return player.containerManager.equipment.getItemCount(itemId);
}

function removePhysical(player, itemId, count) {
    return player.containerManager.equipment.removeItem(itemId, count);
}

function baseTalkState(state, player, message) {

    let lc = message.toLowerCase();

    if (lc.includes("balance") || lc.includes("money")) {
        let balance = player.getBankBalance();
        return this.respond("Your account balance is " + balance + " gold.");
    }

    if (lc.includes("deposit")) {
        this.setTalkState(depositState);
        return this.respond("How many gold coins would you like to deposit?");
    }

    if (lc.includes("withdraw")) {
        this.setTalkState(withdrawState);
        return this.respond("How many gold coins would you like to withdraw?");
    }

    if (lc.includes("exchange") || lc.includes("change")) {
        this.setTalkState(exchangeMenuState);
        return this.respond("Do you want to exchange gold, platinum or crystal coins?");
    }

}

function depositState(state, player, message) {

    let lc = message.toLowerCase();

    if (lc === "all" || lc.includes("all")) {
        let totalGold = player.containerManager.equipment.getTotalGold();
        if (totalGold <= 0) {
            this.respond("You don't have any gold to deposit.");
            this.getTalkStateHandler().reset();
            return;
        }
        player.containerManager.equipment.payWithResource(
            player.containerManager.equipment.CURRENCY.GOLD_COIN,
            totalGold
        );
        let balance = player.getBankBalance();
        player.setBankBalance(balance + totalGold);
        this.respond("You deposited " + totalGold + " gold. Balance: " + (balance + totalGold) + " gold.");
        this.getTalkStateHandler().reset();
        return;
    }

    let amount = parseInt(message);
    if (isNaN(amount) || amount <= 0) {
        this.respond("Tell me an amount or 'all'.");
        this.getTalkStateHandler().reset();
        return;
    }

    let totalGold = player.containerManager.equipment.getTotalGold();
    if (totalGold < amount) {
        this.respond("You don't have that much gold.");
        this.getTalkStateHandler().reset();
        return;
    }

    player.containerManager.equipment.payWithResource(
        player.containerManager.equipment.CURRENCY.GOLD_COIN,
        amount
    );
    let balance = player.getBankBalance();
    player.setBankBalance(balance + amount);

    this.respond("You deposited " + amount + " gold. Balance: " + (balance + amount) + " gold.");
    this.getTalkStateHandler().reset();

}

function withdrawState(state, player, message) {

    let amount = parseInt(message);
    if (isNaN(amount) || amount <= 0) {
        this.respond("Tell me a valid amount.");
        this.getTalkStateHandler().reset();
        return;
    }

    let balance = player.getBankBalance();
    if (balance < amount) {
        this.respond("You don't have that much gold in your account.");
        this.getTalkStateHandler().reset();
        return;
    }

    if (!canHoldValue(player, amount)) {
        this.respond("You don't have enough space.");
        this.getTalkStateHandler().reset();
        return;
    }

    giveGold(player, amount);
    player.setBankBalance(balance - amount);

    this.respond("You withdrew " + amount + " gold. Balance: " + (balance - amount) + " gold.");
    this.getTalkStateHandler().reset();

}

function exchangeMenuState(state, player, message) {

    let lc = message.toLowerCase();

    if (lc.includes("gold")) {
        this.setTalkState(exchangeGoldState);
        return this.respond("How many platinum coins do you want to get?");
    }

    if (lc.includes("platinum")) {
        this.setTalkState(exchangePlatinumMenuState);
        return this.respond("Do you want to change your platinum coins to gold or crystal?");
    }

    if (lc.includes("crystal")) {
        this.setTalkState(exchangeCrystalState);
        return this.respond("How many crystal coins do you want to change to platinum?");
    }

    this.respond("Do you want to exchange gold, platinum or crystal coins?");
    this.getTalkStateHandler().reset();

}

function exchangeGoldState(state, player, message) {

    let count = parseInt(message);
    if (isNaN(count) || count <= 0) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    state.count = count;
    state.amount = count;
    state.price = count * 100;
    this.setTalkState(exchangeGoldConfirmState, state);
    this.respond("So I should change " + state.price + " of your gold coins to " + count + " platinum coins for you?");

}

function exchangeGoldConfirmState(state, player, message) {

    let lc = message.toLowerCase();
    if (!lc.includes("yes")) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    if (getPhysicalCount(player, CURRENCY.GOLD_COIN) < state.price) {
        this.respond("Sorry, you don't have enough gold coins.");
        this.getTalkStateHandler().reset();
        return;
    }

    if (!canHoldSpecificCoins(player, CURRENCY.PLATINUM_COIN, state.count)) {
        this.respond("You don't have enough space in your backpack.");
        this.getTalkStateHandler().reset();
        return;
    }

    removePhysical(player, CURRENCY.GOLD_COIN, state.price);
    giveSpecificCoins(player, CURRENCY.PLATINUM_COIN, state.count);
    this.respond("Here you are.");
    this.getTalkStateHandler().reset();

}

function exchangePlatinumMenuState(state, player, message) {

    let lc = message.toLowerCase();

    if (lc.includes("gold")) {
        this.setTalkState(exchangePlatinumToGoldState);
        return this.respond("How many platinum coins do you want to change to gold?");
    }

    if (lc.includes("crystal")) {
        this.setTalkState(exchangePlatinumToCrystalState);
        return this.respond("How many crystal coins do you want to get?");
    }

    this.respond("Well, can I help you with something else?");
    this.getTalkStateHandler().reset();

}

function exchangePlatinumToGoldState(state, player, message) {

    let count = parseInt(message);
    if (isNaN(count) || count <= 0) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    state.amount = count;
    state.price = count * 100;
    this.setTalkState(exchangePlatinumToGoldConfirmState, state);
    this.respond("So I should change " + count + " of your platinum coins to " + state.price + " gold coins for you?");

}

function exchangePlatinumToGoldConfirmState(state, player, message) {

    let lc = message.toLowerCase();
    if (!lc.includes("yes")) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    if (getPhysicalCount(player, CURRENCY.PLATINUM_COIN) < state.amount) {
        this.respond("Sorry, you don't have so many platinum coins.");
        this.getTalkStateHandler().reset();
        return;
    }

    if (!canHoldSpecificCoins(player, CURRENCY.GOLD_COIN, state.price)) {
        this.respond("You don't have enough space in your backpack.");
        this.getTalkStateHandler().reset();
        return;
    }

    removePhysical(player, CURRENCY.PLATINUM_COIN, state.amount);
    giveSpecificCoins(player, CURRENCY.GOLD_COIN, state.price);
    this.respond("Here you are.");
    this.getTalkStateHandler().reset();

}

function exchangePlatinumToCrystalState(state, player, message) {

    let count = parseInt(message);
    if (isNaN(count) || count <= 0) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    state.amount = count * 100;
    state.price = count;
    this.setTalkState(exchangePlatinumToCrystalConfirmState, state);
    this.respond("So I should change " + state.amount + " of your platinum coins to " + count + " crystal coins for you?");

}

function exchangePlatinumToCrystalConfirmState(state, player, message) {

    let lc = message.toLowerCase();
    if (!lc.includes("yes")) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    if (getPhysicalCount(player, CURRENCY.PLATINUM_COIN) < state.amount) {
        this.respond("Sorry, you don't have so many platinum coins.");
        this.getTalkStateHandler().reset();
        return;
    }

    if (!canHoldSpecificCoins(player, CURRENCY.CRYSTAL_COIN, state.price)) {
        this.respond("You don't have enough space in your backpack.");
        this.getTalkStateHandler().reset();
        return;
    }

    removePhysical(player, CURRENCY.PLATINUM_COIN, state.amount);
    giveSpecificCoins(player, CURRENCY.CRYSTAL_COIN, state.price);
    this.respond("Here you are.");
    this.getTalkStateHandler().reset();

}

function exchangeCrystalState(state, player, message) {

    let count = parseInt(message);
    if (isNaN(count) || count <= 0) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    state.count = count;
    state.amount = count;
    state.price = count * 100;
    this.setTalkState(exchangeCrystalConfirmState, state);
    this.respond("So I should change " + count + " of your crystal coins to " + state.price + " platinum coins for you?");

}

function exchangeCrystalConfirmState(state, player, message) {

    let lc = message.toLowerCase();
    if (!lc.includes("yes")) {
        this.respond("Well, can I help you with something else?");
        this.getTalkStateHandler().reset();
        return;
    }

    if (getPhysicalCount(player, CURRENCY.CRYSTAL_COIN) < state.amount) {
        this.respond("Sorry, you don't have so many crystal coins.");
        this.getTalkStateHandler().reset();
        return;
    }

    if (!canHoldSpecificCoins(player, CURRENCY.PLATINUM_COIN, state.price)) {
        this.respond("You don't have enough space in your backpack.");
        this.getTalkStateHandler().reset();
        return;
    }

    removePhysical(player, CURRENCY.CRYSTAL_COIN, state.amount);
    giveSpecificCoins(player, CURRENCY.PLATINUM_COIN, state.price);
    this.respond("Here you are.");
    this.getTalkStateHandler().reset();

}

module.exports = {
    giveGold,
    giveSpecificCoins,
    placeCoins,
    fillPartialStacks,
    addToEmptySlot,
    canHoldValue,
    canHoldSpecificCoins,
    getPhysicalCount,
    removePhysical,
    baseTalkState,
    depositState,
    withdrawState,
    exchangeMenuState,
    exchangeGoldState,
    exchangeGoldConfirmState,
    exchangePlatinumMenuState,
    exchangePlatinumToGoldState,
    exchangePlatinumToGoldConfirmState,
    exchangePlatinumToCrystalState,
    exchangePlatinumToCrystalConfirmState,
    exchangeCrystalState,
    exchangeCrystalConfirmState
};
