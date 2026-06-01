"use strict";

const fs = require("fs");
const path = require("path");

const ITEMS_JSON = path.resolve(__dirname, "..", "..", "..", "data", "items", "definitions.json");

let itemCache = null;

function loadItems() {
  if (itemCache) return itemCache;

  itemCache = new Map();

  if (!fs.existsSync(ITEMS_JSON)) {
    console.error("definitions.json not found at:", ITEMS_JSON);
    return itemCache;
  }

  const data = JSON.parse(fs.readFileSync(ITEMS_JSON, "utf8"));
  for (const key of Object.keys(data)) {
    const entry = data[key];
    const id = entry.id;
    const name = entry.properties && entry.properties.name;
    if (id != null && name) {
      itemCache.set(id, name);
    }
  }

  return itemCache;
}

function getItemName(id) {
  const items = loadItems();
  return items.get(id) || "Unknown";
}

function getItemsByIds(ids) {
  const items = loadItems();
  return ids.map(function (id) {
    return { id: id, name: items.get(id) || "Unknown" };
  });
}

module.exports = { loadItems, getItemName, getItemsByIds };
