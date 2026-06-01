"use strict";

const fs = require("fs");
const path = require("path");

const QuestDataLoader = function () {
  this.actionsByAid = new Map();
  this.actionsByItemId = new Map();
  this.chests = null;
}

QuestDataLoader.prototype.initialize = function () {
  this.__loadAllQuestFiles();
  this.__loadChests();
  console.log("Loaded [[ %s ]] quest actions by actionId, [[ %s ]] quest items by itemId%s.".format(
    this.actionsByAid.size, this.actionsByItemId.size,
    this.chests ? ", [[ " + Object.keys(this.chests).length + " ]] chests" : ""
  ));
}

QuestDataLoader.prototype.__loadAllQuestFiles = function () {
  const questDir = getDataFile("quests");
  if (!fs.existsSync(questDir)) return;

  const files = this.__walkDir(questDir);
  for (const filePath of files) {
    if (!filePath.endsWith(".json")) continue;
    if (filePath.endsWith("chests.json")) continue;

    try {
      let content = fs.readFileSync(filePath, "utf8");
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        data.forEach(entry => this.__indexQuestAction(entry));
      } else {
        this.__indexQuestAction(data);
      }
    } catch (err) {
      console.error("Failed to load quest file %s: %s".format(filePath, err.message));
    }
  }
}

QuestDataLoader.prototype.__indexQuestAction = function (entry) {
  if (!entry || typeof entry !== "object") return;

  if (entry.actionId !== undefined) {
    this.actionsByAid.set(entry.actionId, entry);
  }
  if (entry.itemId !== undefined) {
    this.actionsByItemId.set(entry.itemId, entry);
  }
}

QuestDataLoader.prototype.__loadChests = function () {
  const chestPath = getDataFile("quests", "chests.json");
  if (!fs.existsSync(chestPath)) return;

  try {
      let content = fs.readFileSync(chestPath, "utf8");
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const data = JSON.parse(content);
    this.chests = data.chests || null;
  } catch (err) {
    console.error("Failed to load chests.json: %s".format(err.message));
  }
}

QuestDataLoader.prototype.__walkDir = function (dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const entry of list) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...this.__walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

QuestDataLoader.prototype.getByActionId = function (aid) {
  return this.actionsByAid.get(aid) || null;
}

QuestDataLoader.prototype.getByItemId = function (itemId) {
  return this.actionsByItemId.get(itemId) || null;
}

QuestDataLoader.prototype.getChestData = function (aid) {
  if (!this.chests) return null;
  return this.chests[String(aid)] || null;
}

QuestDataLoader.prototype.reload = function () {
  this.actionsByAid.clear();
  this.actionsByItemId.clear();
  this.__loadAllQuestFiles();
  this.__loadChests();
}

QuestDataLoader.prototype.getAllQuestActions = function () {
  return Array.from(this.actionsByAid.values());
}

QuestDataLoader.prototype.getAllQuestItems = function () {
  return Array.from(this.actionsByItemId.values());
}

module.exports = QuestDataLoader;
