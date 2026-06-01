"use strict";

const crypto = require("crypto");

const AuthService = function() {

  this.__usedNonces = new Set();
  this.__nonceCleanup = setInterval(function () {
    if (this.__usedNonces.size > 10000) {
      this.__usedNonces.clear();
    }
  }.bind(this), 60000);

}

AuthService.prototype.cleanup = function () {
  if (this.__nonceCleanup) {
    clearInterval(this.__nonceCleanup);
    this.__nonceCleanup = null;
  }
  this.__usedNonces.clear();
};

AuthService.prototype.deriveXorKey = function (token) {
  let payload = this.__parseToken(token);
  if (payload === null) return null;
  let hmacInput = payload.name + payload.expire + (payload.nonce || "");
  let hash = crypto.createHmac("sha256", CONFIG.HMAC.SHARED_SECRET).update(hmacInput).digest();
  return hash.subarray(0, 8);
}

AuthService.prototype.authenticate = function(token) {
  
  /*
   * Function AuthService.authenticate
   * Authentictes a client request with a token
   * Returns { name, xorKey } or null
   */

  // Get the payload from the request
  let payload = this.__parseToken(token);

  // Could not parse payload
  if(payload === null) {
    return null;
  }

  // Could not verify token: it was tampered with or not signed by our login server via the shared HMAC secret
  if(!this.__verifyLoginToken(payload)) {
    return null;
  }

  // The token is valid but has expired
  if(payload.expire <= Date.now()) {
    return null;
  }

  // Derive XOR session key from the token (opt-out via config)
  let xorKey = CONFIG.ENCRYPTION.ENABLED ? this.deriveXorKey(token) : null;

  // Token was verified and succesfully return the name of the account to be loaded
  return {
    name: payload.name,
    xorKey: xorKey
  };

}

AuthService.prototype.__parseToken = function(token) {

  /*
   * Function AuthService.__parseToken
   * Attempt to parse the HMAC token to JSON
   */

  let string = Buffer.from(token, "base64").toString();

  // Wrap token extraction in a try/catch
  try {
    return JSON.parse(string);
  } catch(exception) {
    return null;
  }

}

AuthService.prototype.__verifyLoginToken = function(payload) {

  if(payload === null || typeof payload !== "object") {
    return false;
  }

  if(!payload.hasOwnProperty("name") || !payload.hasOwnProperty("expire") || !payload.hasOwnProperty("hmac") || !payload.hasOwnProperty("nonce")) {
    return false;
  }

  // Reject already-used nonces (replay protection)
  if (this.__usedNonces.has(payload.nonce)) {
    return false;
  }

  let hmacInput = payload.name + payload.expire + payload.nonce;
  let hmac = crypto.createHmac("sha256", CONFIG.HMAC.SHARED_SECRET).update(hmacInput).digest("hex");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(payload.hmac), Buffer.from(hmac))) {
      return false;
    }
  } catch (e) {
    return false;
  }

  this.__usedNonces.add(payload.nonce);
  return true;

}

module.exports = AuthService;
