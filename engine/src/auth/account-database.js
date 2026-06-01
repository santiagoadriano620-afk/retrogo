"use strict";

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const CharacterCreator = requireModule("auth/character-creator");
const Enum = requireModule("utils/enum");
const Cache = requireModule("utils/cache");
const bcrypt = require("bcryptjs");

const DATA_DIR = path.resolve(__dirname, "..", "..", "..", "data");
const DB_DIR = path.resolve(DATA_DIR, "database");
const DB_PATH = path.join(DB_DIR, "tibia.db");
const ACCOUNTS_DIR = path.resolve(DATA_DIR, "accounts");

const MAX_CHARACTERS_PER_ACCOUNT = 5;

function log(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.info(module, action, data);
  } catch (e) {}
}
function logError(module, action, data) {
  try {
    var l = process.gameServer && process.gameServer.logger;
    if (l) l.error(module, action, data);
  } catch (e) {}
}

const AccountDatabase = function () {
  this.characterCreator = new CharacterCreator();
  this.__status = this.STATUS.OPENING;
  this.__cache = new Cache({ maxSize: 5000, ttlMs: 30000 });
  this.__open();
};

AccountDatabase.prototype.STATUS = new Enum("OPENING", "OPEN", "CLOSING", "CLOSED");

AccountDatabase.prototype.__open = function () {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // Migrate old database path if it exists and new one doesn't
  const OLD_DB_PATH = path.resolve(DATA_DIR, "tibia.db");
  if (!fs.existsSync(DB_PATH) && fs.existsSync(OLD_DB_PATH)) {
    fs.copyFileSync(OLD_DB_PATH, DB_PATH);
    var walPath = OLD_DB_PATH + "-wal";
    var shmPath = OLD_DB_PATH + "-shm";
    if (fs.existsSync(walPath)) fs.copyFileSync(walPath, DB_PATH + "-wal");
    if (fs.existsSync(shmPath)) fs.copyFileSync(shmPath, DB_PATH + "-shm");
    console.log("Migrated database from %s to %s".format(OLD_DB_PATH, DB_PATH));
  }

  this.db = new Database(DB_PATH);
  this.db.pragma("journal_mode = WAL");
  this.db.pragma("foreign_keys = ON");

  this.__createTables();
  this.__migrateFromJson();

  // Periodic WAL checkpoint to keep WAL file small
  this.__walCheckpointInterval = setInterval(function () {
    try {
      this.db.pragma("wal_checkpoint(TRUNCATE)");
    } catch (e) {
      /* ignore checkpoint errors */
    }
  }.bind(this), 300000);

  this.__status = this.STATUS.OPEN;
  console.log("SQLite database opened: " + DB_PATH);

  if (!CONFIG.SERVER.PRODUCTION && CONFIG.DATABASE.DEFAULT_CHARACTER.ENABLED) {
    this.__createDefaultCharacter(CONFIG.DATABASE.DEFAULT_CHARACTER);
  }
};

AccountDatabase.prototype.__createTables = function () {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      hash TEXT NOT NULL,
      name TEXT,
      group_id INTEGER DEFAULT 0,
      ip TEXT,
      premium_expiry INTEGER DEFAULT 0,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
    CREATE INDEX IF NOT EXISTS idx_characters_name_lower ON characters(LOWER(name));
    CREATE INDEX IF NOT EXISTS idx_characters_account ON characters(account_id);

    CREATE TABLE IF NOT EXISTS bans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_name TEXT NOT NULL,
      account_id TEXT,
      banned_by TEXT NOT NULL,
      reason TEXT DEFAULT '',
      days INTEGER DEFAULT 0,
      expires_at INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(active);
    CREATE INDEX IF NOT EXISTS idx_bans_character ON bans(character_name);
    CREATE INDEX IF NOT EXISTS idx_bans_character_lower ON bans(LOWER(character_name));

    CREATE TABLE IF NOT EXISTS deaths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_name TEXT NOT NULL,
      killed_by TEXT NOT NULL DEFAULT 'unknown',
      level INTEGER DEFAULT 1,
      killed_by_type TEXT DEFAULT 'monster',
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_deaths_created ON deaths(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deaths_character ON deaths(character_name);

    CREATE TABLE IF NOT EXISTS referral_codes (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      referred_account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      rewarded INTEGER DEFAULT 0,
      created_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_account_id);
    CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
  `);
};

AccountDatabase.prototype.__migrateFromJson = function () {
  const count = this.db.prepare("SELECT COUNT(*) AS cnt FROM accounts").get();
  if (count.cnt > 0) return;

  if (!fs.existsSync(ACCOUNTS_DIR)) return;

  const entries = fs.readdirSync(ACCOUNTS_DIR, { withFileTypes: true });
  let migrated = 0;

  const insertAccount = this.db.prepare(`
    INSERT OR IGNORE INTO accounts (id, hash, name, group_id, ip, premium_expiry, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertCharacter = this.db.prepare(`
    INSERT OR IGNORE INTO characters (account_id, name, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Migrate from new folder format: data/accounts/{account}/account.json + {account}/{name}.json
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(ACCOUNTS_DIR, entry.name, "account.json");
    if (!fs.existsSync(metaPath)) continue;

    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      insertAccount.run(
        meta.account,
        meta.hash,
        meta.name || null,
        meta.group || 0,
        meta.ip || null,
        meta.premiumExpiry || 0,
        meta.createdAt || Date.now(),
        meta.updatedAt || Date.now()
      );

      for (const charName of (meta.characters || [])) {
        const charPath = path.join(ACCOUNTS_DIR, entry.name, charName + ".json");
        if (!fs.existsSync(charPath)) continue;
        const charData = JSON.parse(fs.readFileSync(charPath, "utf-8"));
        insertCharacter.run(
          meta.account,
          charName,
          JSON.stringify(charData),
          meta.createdAt || Date.now(),
          meta.updatedAt || Date.now()
        );
      }
      migrated++;
    } catch (e) {
      console.error("Error migrating account %s: %s".format(entry.name, e.message));
    }
  }

  // Migrate from legacy flat format: data/accounts/{account}.json
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const oldPath = path.join(ACCOUNTS_DIR, entry.name);
    const accountId = entry.name.replace(/\.json$/i, "").toLowerCase();

    try {
      const data = JSON.parse(fs.readFileSync(oldPath, "utf-8"));

      if (data.character && !data.characters) {
        data.characters = [data.character];
        delete data.character;
      }

      if (!data.characters) {
        data.characters = [];
      }

      insertAccount.run(
        data.account || accountId,
        data.hash,
        data.name || (data.characters.length > 0 ? data.characters[0].properties.name : null),
        data.group || 0,
        data.ip || null,
        data.premiumExpiry || 0,
        data.createdAt || Date.now(),
        data.updatedAt || Date.now()
      );

      for (const charData of data.characters) {
        let c = charData;
        if (typeof c === "string") c = JSON.parse(c);
        if (typeof c === "string") c = JSON.parse(c);
        if (c.properties && c.properties.name) {
          insertCharacter.run(
            data.account || accountId,
            c.properties.name,
            JSON.stringify(c),
            data.createdAt || Date.now(),
            data.updatedAt || Date.now()
          );
        }
      }
      migrated++;
    } catch (e) {
      console.error("Error migrating legacy account %s: %s".format(entry.name, e.message));
    }
  }

  if (migrated > 0) {
    console.log("Migrated %s accounts from JSON to SQLite.".format(migrated));
  }
};

AccountDatabase.prototype.close = function () {
  this.__status = this.STATUS.CLOSED;
  if (this.__walCheckpointInterval) {
    clearInterval(this.__walCheckpointInterval);
    this.__walCheckpointInterval = null;
  }
  if (this.__cache) {
    this.__cache.cleanup();
    this.__cache = null;
  }
  if (this.db) {
    try { this.db.pragma("wal_checkpoint(TRUNCATE)"); } catch (e) { /* ok */ }
    this.db.close();
    console.log("SQLite database closed.");
  }
};

AccountDatabase.prototype.createAccount = async function (queryObject, callback) {
  const SALT_ROUNDS = 12;
  const account = queryObject.account.toLowerCase();

  const existing = this.db.prepare("SELECT id FROM accounts WHERE id = ?").get(account);
  if (existing) return callback(409, null);

  try {
    const hash = await bcrypt.hash(queryObject.password, SALT_ROUNDS);
    const name = queryObject.name.capitalize();
    const character = this.characterCreator.create(name, queryObject.sex);
    const charData = JSON.parse(character);
    const now = Date.now();

    const insertAccount = this.db.prepare(`
      INSERT INTO accounts (id, hash, name, group_id, ip, premium_expiry, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCharacter = this.db.prepare(`
      INSERT INTO characters (account_id, name, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const create = this.db.transaction(() => {
      insertAccount.run(account, hash, name, queryObject.group || 0, queryObject.ip || null, 0, now, now);
      insertCharacter.run(account, name, JSON.stringify(charData), now, now);
    });

    create();
    callback(null, null);
  } catch (err) {
    console.error("Error creating account:", err);
    callback(500, null);
  }
};

AccountDatabase.prototype.saveCharacter = async function (gameSocket, callback) {
  try {
    const playerData = JSON.parse(JSON.stringify(gameSocket.player));
    const charName = playerData.properties ? playerData.properties.name : "unknown";
    const now = Date.now();

    const result = this.db.prepare(`
      UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?
    `).run(JSON.stringify(playerData), now, gameSocket.account, charName);

    if (result.changes === 0) {
      logError("account-db", "save_character_not_found", { account: gameSocket.account, character: charName });
      return callback(new Error("Character not found"));
    }

    this.db.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(now, gameSocket.account);
    this.__cache.del("char:" + charName.toLowerCase());
    this.__cache.del("acct:" + gameSocket.account);
    log("account-db", "save_character", { account: gameSocket.account, character: charName, dataSize: JSON.stringify(playerData).length });
    callback(null);
  } catch (error) {
    logError("account-db", "save_character_error", { account: gameSocket.account, error: error.message });
    console.error("Error saving character:", error);
    callback(error);
  }
};

AccountDatabase.prototype.getCharacter = async function (account, callback) {
  try {
    const cacheKey = "chars:" + account.toLowerCase();
    const cached = this.__cache.get(cacheKey);
    if (cached !== undefined) {
      return callback(null, { characters: cached });
    }
    const chars = this.db.prepare("SELECT data FROM characters WHERE account_id = ?").all(account);
    const characters = chars.map(function (c) { return JSON.parse(c.data); });
    this.__cache.set(cacheKey, characters, 15000);
    callback(null, { characters: characters });
  } catch (error) {
    console.error("Error getting character:", error);
    callback(error, null);
  }
};

AccountDatabase.prototype.getPremiumExpiry = async function (account, callback) {
  try {
    const row = this.db.prepare("SELECT premium_expiry FROM accounts WHERE id = ?").get(account);
    callback(null, row ? row.premium_expiry : 0);
  } catch (error) {
    console.error("Error getting premium expiry:", error);
    callback(error, 0);
  }
};

AccountDatabase.prototype.setPremiumExpiry = async function (account, expiry) {
  try {
    this.db.prepare("UPDATE accounts SET premium_expiry = ?, updated_at = ? WHERE id = ?").run(expiry, Date.now(), account);
  } catch (error) {
    console.error("Error setting premium expiry:", error);
  }
};

AccountDatabase.prototype.getCharacterByName = async function (account, characterName, callback) {
  try {
    const row = this.db.prepare(`
      SELECT data FROM characters WHERE account_id = ? AND name = ?
    `).get(account, characterName);
    if (!row) return callback(new Error("Character not found"), null);
    callback(null, JSON.parse(row.data));
  } catch (error) {
    console.error("Error getting character by name:", error);
    callback(error, null);
  }
};

AccountDatabase.prototype.addCharacter = async function (account, queryObject, callback) {
  try {
    const count = this.db.prepare("SELECT COUNT(*) AS cnt FROM characters WHERE account_id = ?").get(account);
    if (!count) return callback(404, null);
    if (count.cnt >= MAX_CHARACTERS_PER_ACCOUNT) {
      return callback(403, "Maximum of %s characters per account.".format(MAX_CHARACTERS_PER_ACCOUNT));
    }

    const name = queryObject.name.capitalize();

    const existingChar = this.db.prepare(
      "SELECT id FROM characters WHERE LOWER(name) = LOWER(?)"
    ).get(name);
    if (existingChar) return callback(409, "A character with this name already exists.");

    const character = this.characterCreator.create(name, queryObject.sex);
    const charData = JSON.parse(character);
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO characters (account_id, name, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(account, name, JSON.stringify(charData), now, now);

    this.db.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(now, account);
    this.__cache.del("chars:" + account);
    callback(null, null);
  } catch (error) {
    console.error("Error adding character:", error);
    callback(500, null);
  }
};

AccountDatabase.prototype.findPlayerByName = async function (name, callback) {
  try {
    const row = this.db.prepare(
      "SELECT id FROM characters WHERE LOWER(name) = LOWER(?)"
    ).get(name);
    callback(null, !!row);
  } catch (error) {
    console.error("Error finding player:", error);
    callback(error, false);
  }
};

AccountDatabase.prototype.getAccountCredentials = async function (account, callback) {
  try {
    const cacheKey = "acct:" + account.toLowerCase();
    const cached = this.__cache.get(cacheKey);
    if (cached !== undefined) {
      return callback(null, cached);
    }
    const row = this.db.prepare("SELECT hash, premium_expiry FROM accounts WHERE id = ?").get(account);
    if (!row) return callback(null, undefined);
    const result = { hash: row.hash, premiumExpiry: row.premium_expiry };
    this.__cache.set(cacheKey, result, 15000);
    callback(null, result);
  } catch (error) {
    console.error("Error getting account credentials:", error);
    callback(error, null);
  }
};

AccountDatabase.prototype.deleteCharacter = async function (account, characterName, callback) {
  try {
    const now = Date.now();
    const result = this.db.prepare(
      "DELETE FROM characters WHERE account_id = ? AND name = ?"
    ).run(account, characterName);
    if (result.changes === 0) return callback(new Error("Character not found"));

    const count = this.db.prepare("SELECT COUNT(*) AS cnt FROM characters WHERE account_id = ?").get(account);
    if (count.cnt === 0) {
      this.db.prepare("DELETE FROM accounts WHERE id = ?").run(account);
    } else {
      this.db.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(now, account);
    }

    this.__cache.del("chars:" + account);
    callback(null);
  } catch (error) {
    console.error("Error deleting character:", error);
    callback(error);
  }
};

AccountDatabase.prototype.updateCharacterInbox = async function (ownerName, item, callback) {
  try {
    const row = this.db.prepare(
      "SELECT account_id, data FROM characters WHERE LOWER(name) = LOWER(?)"
    ).get(ownerName.trim());
    if (!row) return callback(true);

    const charData = JSON.parse(row.data);
    if (!charData.containers) charData.containers = {};
    if (!charData.containers.inbox) charData.containers.inbox = [];
    charData.containers.inbox.push(item);

    this.db.prepare("UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?")
      .run(JSON.stringify(charData), Date.now(), row.account_id, ownerName.trim());
    callback(false);
  } catch (error) {
    console.error("Error updating character inbox:", error);
    callback(true);
  }
};

AccountDatabase.prototype.STACKABLE_MAX = 100;

AccountDatabase.prototype.__getMaxStack = function (id) {
  let proto = process.gameServer.database.getThingPrototype(id);
  return proto && proto.isStackable() ? 100 : 1;
};

AccountDatabase.prototype.updateCharacterDepot = async function (ownerName, item, callback) {
  try {
    const row = this.db.prepare(
      "SELECT account_id, data FROM characters WHERE LOWER(name) = LOWER(?)"
    ).get(ownerName.trim());
    if (!row) return callback(true);

    const charData = JSON.parse(row.data);
    if (!charData.containers) charData.containers = {};
    if (!charData.containers.depot) charData.containers.depot = [];

    let depot = charData.containers.depot;
    let maxStack = this.__getMaxStack(item.id);
    let inserted = false;

    if (maxStack > 1) {
      for (let i = 0; i < depot.length; i++) {
        let slot = depot[i];
        if (slot && slot.id === item.id && slot.count < maxStack) {
          let space = maxStack - slot.count;
          let add = Math.min(space, item.count || 1);
          slot.count = (slot.count || 0) + add;
          item.count = (item.count || 1) - add;
          if (item.count <= 0) {
            inserted = true;
            break;
          }
        }
      }
    }

    if (!inserted) {
      for (let i = 0; i < depot.length; i++) {
        if (depot[i] === null || depot[i] === undefined) {
          depot[i] = item;
          inserted = true;
          break;
        }
      }
    }

    if (!inserted) {
      if (!charData.containers.inbox) charData.containers.inbox = [];
      charData.containers.inbox.push(item);
    }

    this.db.prepare("UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?")
      .run(JSON.stringify(charData), Date.now(), row.account_id, ownerName.trim());
    callback(false);
  } catch (error) {
    console.error("Error updating character depot:", error);
    callback(true);
  }
};

AccountDatabase.prototype.savePlayerDirectly = function (player, accountId) {
  try {
    const playerData = JSON.parse(JSON.stringify(player));
    const now = Date.now();
    var charName = playerData.properties ? playerData.properties.name : "unknown";
    const result = this.db.prepare(`
      UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?
    `).run(JSON.stringify(playerData), now, accountId, charName);
    if (result.changes > 0) {
      this.db.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(now, accountId);
      log("account-db", "save_player_direct", { account: accountId, character: charName });
    } else {
      logError("account-db", "save_player_direct_not_found", { account: accountId, character: charName });
    }
    return result.changes > 0;
  } catch (error) {
    logError("account-db", "save_player_direct_error", { account: accountId, error: error.message });
    console.error("Error in direct player save:", error);
    return false;
  }
};

AccountDatabase.prototype.setCharacterPositionToTemple = function (characterName) {
  try {
    const row = this.db.prepare("SELECT account_id, data FROM characters WHERE LOWER(name) = LOWER(?)").get(characterName.trim());
    if (!row) return false;
    const charData = JSON.parse(row.data);
    if (charData.templePosition) {
      charData.position = charData.templePosition;
      this.db.prepare("UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?")
        .run(JSON.stringify(charData), Date.now(), row.account_id, characterName.trim());
      return true;
    }
  } catch (e) {
    console.error("Error setting character position to temple:", e);
  }
  return false;
};

AccountDatabase.prototype.recordDeath = function (characterName, killedBy, level, killedByType) {
  try {
    this.db.prepare(`
      INSERT INTO deaths (character_name, killed_by, level, killed_by_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(characterName, killedBy, level, killedByType, Date.now());
    return { success: true };
  } catch (error) {
    console.error("Error recording death:", error);
    return { success: false, error: error.message };
  }
};

AccountDatabase.prototype.getDeathsList = function (limit, offset) {
  try {
    let rows = this.db.prepare(
      "SELECT * FROM deaths ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
    let total = this.db.prepare(
      "SELECT COUNT(*) AS cnt FROM deaths"
    ).get();
    return { entries: rows, total: total.cnt };
  } catch (error) {
    console.error("Error getting deaths list:", error);
    return { entries: [], total: 0 };
  }
};

AccountDatabase.prototype.getBanByName = function (characterName) {
  try {
    const key = characterName.trim().toLowerCase();
    const cacheKey = "ban:" + key;
    const cached = this.__cache.get(cacheKey);
    if (cached !== undefined) return cached;
    const result = this.db.prepare(
      "SELECT * FROM bans WHERE LOWER(character_name) = LOWER(?) AND active = 1"
    ).get(key);
    this.__cache.set(cacheKey, result || null, 30000);
    return result;
  } catch (error) {
    console.error("Error getting ban by name:", error);
    return null;
  }
};

AccountDatabase.prototype.getBansList = function (limit, offset) {
  try {
    let rows = this.db.prepare(
      "SELECT * FROM bans WHERE active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
    let total = this.db.prepare(
      "SELECT COUNT(*) AS cnt FROM bans WHERE active = 1"
    ).get();
    return { entries: rows, total: total.cnt };
  } catch (error) {
    console.error("Error getting bans list:", error);
    return { entries: [], total: 0 };
  }
};

AccountDatabase.prototype.getBansHistory = function (limit, offset) {
  try {
    let rows = this.db.prepare(
      "SELECT * FROM bans ORDER BY created_at DESC LIMIT ? OFFSET ?"
    ).all(limit, offset);
    let total = this.db.prepare(
      "SELECT COUNT(*) AS cnt FROM bans"
    ).get();
    return { entries: rows, total: total.cnt };
  } catch (error) {
    console.error("Error getting bans history:", error);
    return { entries: [], total: 0 };
  }
};

AccountDatabase.prototype.createBan = function (characterName, bannedBy, days, reason) {
  try {
    let now = Date.now();
    let expiresAt = days > 0 ? now + days * 86400000 : 0;
    let info = this.db.prepare(
      "SELECT account_id FROM characters WHERE LOWER(name) = LOWER(?)"
    ).get(characterName.trim());
    let accountId = info ? info.account_id : null;

    this.db.prepare(
      "UPDATE bans SET active = 0 WHERE LOWER(character_name) = LOWER(?)"
    ).run(characterName.trim());

    this.db.prepare(`
      INSERT INTO bans (character_name, account_id, banned_by, reason, days, expires_at, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(characterName.trim(), accountId, bannedBy, reason, days, expiresAt, now);

    this.__cache.del("ban:" + characterName.trim().toLowerCase());
    return { success: true };
  } catch (error) {
    console.error("Error creating ban:", error);
    return { success: false, error: error.message };
  }
};

AccountDatabase.prototype.updateBan = function (characterName, days, reason) {
  try {
    let now = Date.now();
    let expiresAt = days > 0 ? now + days * 86400000 : 0;
    this.db.prepare(
      "UPDATE bans SET days = ?, reason = ?, expires_at = ? WHERE LOWER(character_name) = LOWER(?) AND active = 1"
    ).run(days, reason, expiresAt, characterName.trim());
    this.__cache.del("ban:" + characterName.trim().toLowerCase());
    return { success: true };
  } catch (error) {
    console.error("Error updating ban:", error);
    return { success: false, error: error.message };
  }
};

AccountDatabase.prototype.removeBan = function (characterName) {
  try {
    this.db.prepare(
      "UPDATE bans SET active = 0 WHERE LOWER(character_name) = LOWER(?) AND active = 1"
    ).run(characterName.trim());
    this.__cache.del("ban:" + characterName.trim().toLowerCase());
    return { success: true };
  } catch (error) {
    console.error("Error removing ban:", error);
    return { success: false, error: error.message };
  }
};

AccountDatabase.prototype.generateReferralCode = function (accountId) {
  let existing = this.db.prepare("SELECT code FROM referral_codes WHERE account_id = ?").get(accountId);
  if (existing) return existing.code;

  let chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let length = CONFIG.REFERRAL.CODE_LENGTH || 5;
  let code;
  do {
    code = "";
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (this.db.prepare("SELECT account_id FROM referral_codes WHERE code = ?").get(code));

  this.db.prepare("INSERT INTO referral_codes (account_id, code, created_at) VALUES (?, ?, ?)")
    .run(accountId, code, Date.now());
  return code;
};

AccountDatabase.prototype.getReferralCode = function (accountId) {
  let row = this.db.prepare("SELECT code FROM referral_codes WHERE account_id = ?").get(accountId);
  if (row) return row.code;
  return this.generateReferralCode(accountId);
};

AccountDatabase.prototype.getReferrerByCode = function (code) {
  let row = this.db.prepare("SELECT account_id FROM referral_codes WHERE code = ?").get(code);
  return row ? row.account_id : null;
};

AccountDatabase.prototype.createReferral = function (referrerAccountId, referredAccountId, code) {
  let existing = this.db.prepare("SELECT id FROM referrals WHERE referred_account_id = ?").get(referredAccountId);
  if (existing) return false;
  this.db.prepare("INSERT INTO referrals (referrer_account_id, referred_account_id, code, rewarded, created_at) VALUES (?, ?, ?, 0, ?)")
    .run(referrerAccountId, referredAccountId, code, Date.now());
  return true;
};

AccountDatabase.prototype.getReferralStats = function (accountId) {
  let total = this.db.prepare("SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_account_id = ?").get(accountId);
  let rewarded = this.db.prepare("SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_account_id = ? AND rewarded = 1").get(accountId);
  let pending = this.db.prepare("SELECT COUNT(*) AS cnt FROM referrals WHERE referrer_account_id = ? AND rewarded = 0").get(accountId);
  return { total: total.cnt, rewarded: rewarded.cnt, pending: pending.cnt };
};

AccountDatabase.prototype.checkAndRewardReferrals = function (accountId) {
  try {
    let pendingReferrals = this.db.prepare(
      "SELECT id, referrer_account_id, code FROM referrals WHERE referred_account_id = ? AND rewarded = 0"
    ).all(accountId);

    if (pendingReferrals.length === 0) return;

    let levelRequired = CONFIG.REFERRAL.LEVEL_REQUIRED || 20;
    let reward = CONFIG.REFERRAL.REWARD_PREMIUM_POINTS || 10;

    for (let ref of pendingReferrals) {
      let characters = this.db.prepare(
        "SELECT data FROM characters WHERE account_id = ?"
      ).all(accountId);

      let anyHighLevel = false;
      for (let row of characters) {
        let charData = JSON.parse(row.data);
        let exp = charData.skills ? charData.skills.experience || 0 : 0;
        let level = 1;
        if (exp > 0) {
          for (let lvl = 1; lvl <= 1000; lvl++) {
            let required = Math.round((50 / 3) * (Math.pow(lvl, 3) - 6 * Math.pow(lvl, 2) + 17 * lvl - 12));
            if (required > exp) { level = lvl - 1; break; }
          }
        }
        if (level >= levelRequired) {
          anyHighLevel = true;
          break;
        }
      }

      if (anyHighLevel) {
        let referrerChars = this.db.prepare(
          "SELECT name, data FROM characters WHERE account_id = ?"
        ).all(ref.referrer_account_id);

        let saveChar = this.db.prepare("UPDATE characters SET data = ?, updated_at = ? WHERE account_id = ? AND name = ?");
        let now = Date.now();

        for (let rc of referrerChars) {
          let charData = JSON.parse(rc.data);
          charData.premiumPoints = (charData.premiumPoints || 0) + reward;
          saveChar.run(JSON.stringify(charData), now, ref.referrer_account_id, rc.name);
        }

        this.db.prepare("UPDATE referrals SET rewarded = 1 WHERE id = ?").run(ref.id);
        console.log("Referral reward: account %s rewarded %s premium points (referred account %s reached level %s)".format(
          ref.referrer_account_id, reward, accountId, levelRequired));
      }
    }
  } catch (error) {
    console.error("Error checking referral rewards:", error);
  }
};

AccountDatabase.prototype.searchCharacters = function (query) {
  try {
    return this.db.prepare(
      "SELECT name, data FROM characters WHERE LOWER(name) LIKE LOWER(?) LIMIT 20"
    ).all("%" + query.trim() + "%").map(function (row) {
      let p = JSON.parse(row.data);
      let props = p.properties || {};
      return {
        name: row.name,
        level: props.level || 1,
        vocation: props.vocation || 0,
        outfit: props.outfit || null
      };
    });
  } catch (error) {
    console.error("Error searching characters:", error);
    return [];
  }
};

module.exports = AccountDatabase;
