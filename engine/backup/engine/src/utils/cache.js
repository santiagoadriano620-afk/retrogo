"use strict";

const Cache = function (opts) {
  this._maxSize = opts.maxSize || 1000;
  this._ttlMs = opts.ttlMs || 60000;
  this._store = new Map();
  this._cleanupInterval = setInterval(this._evictStale.bind(this), 30000);
};

Cache.prototype.get = function (key) {
  const entry = this._store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    this._store.delete(key);
    return undefined;
  }
  return entry.value;
};

Cache.prototype.set = function (key, value, ttlMs) {
  if (this._store.size >= this._maxSize) {
    const firstKey = this._store.keys().next().value;
    this._store.delete(firstKey);
  }
  this._store.set(key, {
    value,
    expiresAt: Date.now() + (ttlMs || this._ttlMs)
  });
};

Cache.prototype.del = function (key) {
  this._store.delete(key);
};

Cache.prototype.clear = function () {
  this._store.clear();
};

Cache.prototype._evictStale = function () {
  const now = Date.now();
  for (const [key, entry] of this._store) {
    if (now > entry.expiresAt) {
      this._store.delete(key);
    }
  }
};

Cache.prototype.cleanup = function () {
  if (this._cleanupInterval) {
    clearInterval(this._cleanupInterval);
    this._cleanupInterval = null;
  }
  this._store.clear();
};

module.exports = Cache;
