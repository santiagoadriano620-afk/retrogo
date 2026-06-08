"use strict";

const RateLimiter = function () {
  this.__ips = new Map();
  this.__cleanupInterval = setInterval(this.__cleanup.bind(this), 60000);
}

RateLimiter.prototype.check = function (ip, key, maxAttempts, windowMs) {
  let now = Date.now();
  let record = this.__getRecord(ip, key);

  if (record === null) {
    this.__setRecord(ip, key, now, 1);
    return true;
  }

  if (now - record.timestamp > windowMs) {
    this.__setRecord(ip, key, now, 1);
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count++;
  return true;
}

RateLimiter.prototype.getRemainingCooldown = function (ip, key, windowMs) {
  let record = this.__getRecord(ip, key);
  if (record === null) return 0;
  let elapsed = Date.now() - record.timestamp;
  return Math.max(0, windowMs - elapsed);
}

RateLimiter.prototype.__getRecord = function (ip, key) {
  let ipMap = this.__ips.get(ip);
  if (!ipMap) return null;
  return ipMap.get(key) || null;
}

RateLimiter.prototype.__setRecord = function (ip, key, timestamp, count) {
  if (!this.__ips.has(ip)) {
    this.__ips.set(ip, new Map());
  }
  this.__ips.get(ip).set(key, { timestamp, count });
}

RateLimiter.prototype.__cleanup = function () {
  let cutoff = Date.now() - 120000;
  for (let [ip, ipMap] of this.__ips) {
    for (let [key, record] of ipMap) {
      if (record.timestamp < cutoff) {
        ipMap.delete(key);
      }
    }
    if (ipMap.size === 0) {
      this.__ips.delete(ip);
    }
  }
}

RateLimiter.prototype.cleanup = function () {
  if (this.__cleanupInterval) {
    clearInterval(this.__cleanupInterval);
    this.__cleanupInterval = null;
  }
  this.__ips.clear();
}

module.exports = RateLimiter;
