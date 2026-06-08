const Ignorelist = function (data) {
  this.__ignored = new Set(data || []);
}

Ignorelist.prototype.add = function (name) {
  this.__ignored.add(name);
  this.__updateDOM();
}

Ignorelist.prototype.remove = function (name) {
  this.__ignored.delete(name);
  this.__updateDOM();
}

Ignorelist.prototype.has = function (name) {
  return this.__ignored.has(name);
}

Ignorelist.prototype.getList = function () {
  return Array.from(this.__ignored).sort();
}

Ignorelist.prototype.clear = function () {
  this.__ignored.clear();
}

Ignorelist.prototype.__updateDOM = function () {
}
