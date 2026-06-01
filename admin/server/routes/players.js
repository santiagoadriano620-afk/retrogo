"use strict";

const express = require("express");
const Db = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const db = require("../lib/database");
const bridge = require("../lib/game-bridge");
const items = require("../lib/items");

const router = express.Router();

const VOCATIONS = ["None", "Sorcerer", "Druid", "Paladin", "Knight", "Admin"];

let _adminDb = null;
function adminDb() {
  if (_adminDb) return _adminDb;
  const p = path.resolve(__dirname, "..", "..", "..", "data", "database", "tibia.db");
  if (!fs.existsSync(p)) return null;
  _adminDb = new Db(p);
  _adminDb.pragma("journal_mode = WAL");
  return _adminDb;
}

router.get("/", function (req, res) {
  const search = (req.query.search || "").toLowerCase().trim();
  const vocation = parseInt(req.query.vocation, 10);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

  let characters = db.getAllCharacters();
  if (search) {
    characters = characters.filter(function (c) {
      return c.name && c.name.toLowerCase().includes(search);
    });
  }
  if (!isNaN(vocation) && vocation > 0) {
    characters = characters.filter(function (c) {
      return c.vocation === vocation;
    });
  }

  const total = characters.length;
  const offset = (page - 1) * limit;
  const paged = characters.slice(offset, offset + limit);

  res.json({
    players: paged,
    total: total,
    page: page,
    limit: limit,
    totalPages: Math.ceil(total / limit)
  });
});

router.get("/online", async function (req, res) {
  const result = await bridge.getPlayers();
  if (result.error) {
    return res.json({ players: [], online: false, error: result.error });
  }
  res.json({ players: result.players, online: true });
});

// ── Item Search (must be BEFORE /:name to avoid route conflict) ──────────────

function describeLocation(path) {
  if (!path) return 'data root';
  const p = path.replace(/^containers\./, '').replace(/\['?(\d+)'?\]/g, '[$1]');
  const SLOT_NAMES = ['Head', 'Amulet', 'Backpack', 'Armor', 'Right Hand', 'Left Hand', 'Legs', 'Boots', 'Ring', 'Ammo'];
  const equipMatch = p.match(/^equipment\[(\d+)\]/);
  if (equipMatch) {
    const si = parseInt(equipMatch[1], 10);
    const slotLabel = SLOT_NAMES[si] || ('Slot ' + si);
    const rest = p.slice(equipMatch[0].length);
    if (!rest) return 'Equipment: ' + slotLabel;
    return 'Equipment (' + slotLabel + ')' + rest;
  }
  if (p.startsWith('depot[')) return 'Depot ' + p;
  if (p.startsWith('inbox')) return 'Inbox';
  if (p.startsWith('stash')) return 'Stash';
  if (p.includes('items[')) return 'Container' + p.replace(/items\[(\d+)\]/g, ' slot $1');
  return p;
}

function searchItemInData(data, targetId) {
  const flatResults = [];
  function walk(obj, path, parentId) {
    if (!obj || typeof obj !== 'object') return;
    const id = obj.id || obj.itemId || 0;
    if (id === targetId) {
      flatResults.push({ count: obj.count || obj.amount || 1, location: describeLocation(path), parentContainer: parentId || 0 });
    }
    const hasItems = Array.isArray(obj.items);
    const nextParent = (id === targetId || id > 0) ? id : parentId;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val)) {
        val.forEach(function (item, idx) {
          if (item && typeof item === 'object') {
            walk(item, path ? path + '.' + key + '[' + idx + ']' : key + '[' + idx + ']', hasItems ? id : nextParent);
          }
        });
      } else if (val && typeof val === 'object') {
        walk(val, path ? path + '.' + key : key, nextParent);
      }
    }
  }
  walk(data, '', 0);
  const grouped = {};
  flatResults.forEach(function (r) {
    const key = r.location;
    if (!grouped[key]) grouped[key] = { location: key, count: 0, items: 0 };
    grouped[key].count += r.count;
    grouped[key].items += 1;
  });
  return Object.values(grouped);
}

router.get("/search-item", function (req, res) {
  const itemId = parseInt(req.query.itemId, 10);
  if (isNaN(itemId) || itemId < 1) return res.status(400).json({ error: "Invalid itemId parameter" });
  const d = adminDb();
  if (!d) return res.status(500).json({ error: "Database error" });
  const rows = d.prepare("SELECT name, data FROM characters").all();
  d.close();
  const itemName = items.getItemName(itemId);
  const found = [];
  for (const row of rows) {
    try {
      const data = JSON.parse(row.data);
      const matches = searchItemInData(data, itemId);
      if (matches.length > 0) {
        const totalCount = matches.reduce(function (sum, m) { return sum + m.count; }, 0);
        found.push({ player: row.name, total: totalCount, matches: matches });
      }
    } catch (e) {}
  }
  res.json({ itemId: itemId, itemName: itemName, results: found });
});

// ── Player routes ────────────────────────────────────────────────────────────

router.get("/:name", function (req, res) {
  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  const props = char.data.properties || {};
  const rawSkills = char.data.skills || {};

  let ban = null;
  try {
    const d = adminDb();
    if (d) {
      ban = d.prepare("SELECT * FROM bans WHERE LOWER(character_name) = LOWER(?) AND active = 1").get(req.params.name.trim());
      d.close();
    }
  } catch (e) {}

  // Inject item names into raw data without changing structure
  function injectItemNames(obj) {
    if (!obj || typeof obj !== 'object') return;
    const id = obj.id || obj.itemId;
    if (id && !obj.name) obj.name = items.getItemName(id);
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val)) val.forEach(injectItemNames);
      else if (val && typeof val === 'object') injectItemNames(val);
    }
  }
  if (char.data) injectItemNames(char.data);

  res.json({
    name: char.name,
    account_id: char.account_id,
    level: char.level,
    vocation: char.vocation,
    premiumPoints: char.data.premiumPoints || 0,
    ban: ban ? {
      id: ban.id,
      reason: ban.reason,
      days: ban.days,
      banned_by: ban.banned_by,
      expires_at: ban.expires_at,
      created_at: ban.created_at,
      active: ban.active === 1
    } : null,
    computedSkills: char.skills,
    properties: {
      name: props.name,
      health: props.health,
      healthMax: props.healthMax || props.maxHealth,
      mana: props.mana,
      manaMax: props.manaMax || props.maxMana,
      capacity: props.capacityMax || props.maxCapacity || props.capacity,
      speed: props.speed,
      sex: props.sex,
      vocation: props.vocation,
      outfit: props.outfit,
      attack: props.attack,
      defense: props.defense,
    },
    rawSkills: {
      magic: rawSkills.magic || 0,
      fist: rawSkills.fist || 0,
      club: rawSkills.club || 0,
      sword: rawSkills.sword || 0,
      axe: rawSkills.axe || 0,
      distance: rawSkills.distance || 0,
      shielding: rawSkills.shielding || 0,
      fishing: rawSkills.fishing || 0,
      experience: rawSkills.experience || 0,
    },
    data: char.data
  });
});

router.get("/:name/depot", function (req, res) {
  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  const data = char.data;
  const containers = data.containers || {};

  const depotItems = [];
  if (containers.depot) {
    depotItems.push({
      label: "Depot",
      items: flattenItems(containers.depot)
    });
  }

  if (containers.inbox) {
    depotItems.push({
      label: "Inbox",
      items: flattenItems(containers.inbox)
    });
  }

  const inventory = {};
  if (containers.inventory) {
    Object.keys(containers.inventory).forEach(function (slot) {
      inventory[slot] = flattenItems(containers.inventory[slot]);
    });
  }

  res.json({ inventory: inventory, storage: depotItems });
});

router.put("/:name/level", async function (req, res) {
  const { level } = req.body;
  if (!level || level < 1 || level > 1000) {
    return res.status(400).json({ error: "Level must be between 1 and 1000" });
  }

  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  const exp = db.getExpForLevel(parseInt(level));
  char.data.skills = char.data.skills || {};
  char.data.skills.experience = exp;

  const engineResult = await bridge.updatePlayer({
    name: req.params.name,
    experience: parseInt(level)
  });

  if (engineResult.success) {
    return res.json({ success: true, level: parseInt(level), experience: exp, live: true });
  }

  if (db.updateCharacterData(req.params.name, char.data)) {
    res.json({ success: true, level: parseInt(level), experience: exp });
  } else {
    res.status(500).json({ error: "Failed to update player" });
  }
});

router.put("/:name/skills", async function (req, res) {
  const { magic, fist, club, sword, axe, distance, shielding, fishing } = req.body;

  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  function clampSkill(val, min, max) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < min) return min;
    if (n > max) return max;
    return n;
  }

  const vocation = char.vocation || 0;
  char.data.skills = char.data.skills || {};

  if (magic !== undefined) char.data.skills.magic = db.getTriesForSkillLevel(clampSkill(magic, 0, 200), vocation, "magic");
  if (fist !== undefined) char.data.skills.fist = db.getTriesForSkillLevel(clampSkill(fist, 0, 200), vocation, "fist");
  if (club !== undefined) char.data.skills.club = db.getTriesForSkillLevel(clampSkill(club, 0, 200), vocation, "club");
  if (sword !== undefined) char.data.skills.sword = db.getTriesForSkillLevel(clampSkill(sword, 0, 200), vocation, "sword");
  if (axe !== undefined) char.data.skills.axe = db.getTriesForSkillLevel(clampSkill(axe, 0, 200), vocation, "axe");
  if (distance !== undefined) char.data.skills.distance = db.getTriesForSkillLevel(clampSkill(distance, 0, 200), vocation, "distance");
  if (shielding !== undefined) char.data.skills.shielding = db.getTriesForSkillLevel(clampSkill(shielding, 0, 200), vocation, "shielding");
  if (fishing !== undefined) char.data.skills.fishing = db.getTriesForSkillLevel(clampSkill(fishing, 0, 200), vocation, "fishing");

  const engineResult = await bridge.updatePlayer({
    name: req.params.name,
    ...(magic !== undefined && { magic: parseInt(magic) }),
    ...(fist !== undefined && { fist: parseInt(fist) }),
    ...(club !== undefined && { club: parseInt(club) }),
    ...(sword !== undefined && { sword: parseInt(sword) }),
    ...(axe !== undefined && { axe: parseInt(axe) }),
    ...(distance !== undefined && { distance: parseInt(distance) }),
    ...(shielding !== undefined && { shielding: parseInt(shielding) }),
    ...(fishing !== undefined && { fishing: parseInt(fishing) }),
  });

  if (engineResult.success) {
    return res.json({ success: true, live: true });
  }

  if (db.updateCharacterData(req.params.name, char.data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to update player" });
  }
});

router.put("/:name/property", function (req, res) {
  const { key, value } = req.body;
  if (!key || value === undefined) {
    return res.status(400).json({ error: "Key and value are required" });
  }

  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  if (key === "vocation" || key === "sex") {
    char.data.properties = char.data.properties || {};
    char.data.properties[key] = parseInt(value, 10);
  } else {
    char.data.properties = char.data.properties || {};
    char.data.properties[key] = value;
  }

  if (db.updateCharacterData(req.params.name, char.data)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: "Failed to update player" });
  }
});

router.delete("/:name/kick", async function (req, res) {
  const result = await bridge.kickPlayer(req.params.name);
  if (result.error && result.code === "CONNECTION_REFUSED") {
    return res.json({ success: false, error: "Engine offline", offline: true });
  }
  res.json(result);
});

router.get("/items", function (req, res) {
  const ids = req.query.ids ? req.query.ids.split(",").map(Number) : [];
  const result = {};
  ids.forEach(function (id) {
    if (!isNaN(id)) result[id] = items.getItemName(id);
  });
  res.json(result);
});

router.put("/:name/premium", async function (req, res) {
  const { amount } = req.body;
  if (amount === undefined || isNaN(parseInt(amount, 10)) || parseInt(amount, 10) === 0) {
    return res.status(400).json({ error: "Amount must be a non-zero integer" });
  }

  const char = db.getCharacterByName(req.params.name);
  if (!char) {
    return res.status(404).json({ error: "Player not found" });
  }

  const delta = parseInt(amount, 10);
  char.data.premiumPoints = Math.max(0, (char.data.premiumPoints || 0) + delta);

  const engineResult = await bridge.updatePremiumPoints(req.params.name, delta);
  if (engineResult.success) {
    return res.json({ success: true, premiumPoints: engineResult.premiumPoints, live: true });
  }

  if (db.updateCharacterData(req.params.name, char.data)) {
    res.json({ success: true, premiumPoints: char.data.premiumPoints });
  } else {
    res.status(500).json({ error: "Failed to update premium points" });
  }
});

router.put("/:name/ban", function (req, res) {
  const { days, reason } = req.body;
  if (!days || days < 0) {
    return res.status(400).json({ error: "Duration in days is required" });
  }

  const d = adminDb();
  if (!d) return res.status(500).json({ error: "Database error" });

  try {
    const now = Date.now();
    const expiresAt = parseInt(days) > 0 ? now + parseInt(days) * 86400000 : 0;
    const name = req.params.name.trim();

    const info = d.prepare("SELECT account_id FROM characters WHERE LOWER(name) = LOWER(?)").get(name);
    const accountId = info ? info.account_id : null;

    d.prepare("UPDATE bans SET active = 0 WHERE LOWER(character_name) = LOWER(?)").run(name);
    d.prepare(`
      INSERT INTO bans (character_name, account_id, banned_by, reason, days, expires_at, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(name, accountId, "Admin Panel", reason || "", parseInt(days), expiresAt, now);

    d.close();
    res.json({ success: true });
  } catch (e) {
    d.close();
    res.status(500).json({ error: e.message });
  }
});

router.put("/:name/unban", function (req, res) {
  const d = adminDb();
  if (!d) return res.status(500).json({ error: "Database error" });

  try {
    d.prepare("UPDATE bans SET active = 0 WHERE LOWER(character_name) = LOWER(?) AND active = 1")
      .run(req.params.name.trim());
    d.close();
    res.json({ success: true });
  } catch (e) {
    d.close();
    res.status(500).json({ error: e.message });
  }
});

function flattenItems(arr) {
  if (!arr || !Array.isArray(arr)) return [];
  return arr.map(function (item) {
    if (!item) return null;
    if (typeof item === "number") return { id: item, name: items.getItemName(item) };
    if (item.items && Array.isArray(item.items)) {
      return {
        id: item.id || 0,
        count: item.count || 1,
        name: items.getItemName(item.id),
        container: true,
        contents: flattenItems(item.items)
      };
    }
    if (item.id) {
      return {
        id: item.id,
        count: item.count || 1,
        name: items.getItemName(item.id),
        attributes: item.attributes || item.actionId ? { actionId: item.actionId } : undefined
      };
    }
    if (item.itemId) {
      return {
        id: item.itemId,
        count: item.count || item.amount || 1,
        name: items.getItemName(item.itemId),
        attributes: item.actionId ? { actionId: item.actionId } : undefined
      };
    }
    return item;
  }).filter(Boolean);
}

module.exports = router;
