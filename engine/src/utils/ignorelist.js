"use strict";

const Ignorelist = function(ignored) {
  this.ignored = new Set(ignored);
}

Ignorelist.prototype.remove = function(name) {
  if(!this.ignored.has(name)) {
    return;
  }
  this.ignored.delete(name);
}

Ignorelist.prototype.add = function(name) {
  if(this.ignored.has(name)) {
    return false;
  }
  this.ignored.add(name);
  return true;
}

Ignorelist.prototype.has = function(name) {
  return this.ignored.has(name);
}

Ignorelist.prototype.toJSON = function() {
  return Array.from(this.ignored);
}

Ignorelist.prototype.getList = function() {
  return Array.from(this.ignored);
}

module.exports = Ignorelist;
