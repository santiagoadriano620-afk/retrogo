"use strict";

const DeathModal = function (element) {

    /*
     * Class DeathModal
     * Modal that appears when player dies - confirms logout to respawn at temple
     */

    // Inherit from modal
    Modal.call(this, element);

    // Guard against double-click (OK button triggering multiple logout + reconnect)
    this.__confirmed = false;

}

DeathModal.prototype = Object.create(Modal.prototype);
DeathModal.prototype.constructor = DeathModal;

DeathModal.prototype.handleConfirm = function () {

    /*
     * Function DeathModal.handleConfirm
     * When confirmed, send logout packet then auto-reconnect to respawn at temple
     */

    // Prevent double-click: only process the first confirmation
    if (this.__confirmed) {
        return false;
    }
    this.__confirmed = true;

    console.log("Death modal confirmed - sending logout to respawn at temple");

    // Send logout packet
    gameClient.send(new LogoutPacket());

    // Auto-reconnect after socket fully closes (2 seconds to ensure cleanup)
    console.log("Setting up auto-reconnect timer...");
    setTimeout(function () {
        console.log("Timer fired! Checking connection state...");
        console.log("isConnected:", gameClient.networkManager.isConnected());
        console.log("Auto-reconnecting to respawn at temple...");
        gameClient.networkManager.connect();
    }, 2000);

    return true;

}

DeathModal.prototype.handleCancel = function () {

    /*
     * Function DeathModal.handleCancel
     * Logout: disconnect from server and return to login screen
     */

    gameClient.networkManager.close();
    return true;

}
