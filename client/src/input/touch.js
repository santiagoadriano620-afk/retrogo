"use strict";

const Touch = function () {
  this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
};

Touch.prototype.isMobileMode = false;

Touch.prototype.updateStatusBars = function () {};

Touch.prototype.syncMobileHotbar = function () {};
