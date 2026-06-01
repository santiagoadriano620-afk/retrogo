"use strict";

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = path.resolve(__dirname, "..", "..", "..", "data", "database", "tibia.db");

let db = null;

// ─── Skill formulae (mirrors engine/src/utils/skill.js) ──────────────────────

const SKILL_CONST = { magic: 1600, fist: 50, club: 50, sword: 50, axe: 50, distance: 25, shielding: 100, fishing: 20 };

const VOC_MULT = {
  0: { magic: 3.0, club: 2.0, sword: 2.0, axe: 2.0, distance: 2.0, fist: 1.5, shielding: 1.5, fishing: 1.1 },
  1: { magic: 3.0, club: 1.1, sword: 1.1, axe: 1.1, distance: 1.4, fist: 1.1, shielding: 1.1, fishing: 1.1 },
  2: { magic: 1.4, club: 1.2, sword: 1.2, axe: 1.2, distance: 1.1, fist: 1.2, shielding: 1.1, fishing: 1.1 },
  3: { magic: 1.1, club: 2.0, sword: 2.0, axe: 2.0, distance: 2.0, fist: 1.5, shielding: 1.5, fishing: 1.1 },
  4: { magic: 1.1, club: 1.8, sword: 1.8, axe: 1.8, distance: 1.8, fist: 1.5, shielding: 1.5, fishing: 1.1 },
};

function getLevelFromExp(exp) {
  if (!exp || exp <= 0) return 1;
  for (let lvl = 1; lvl <= 1000; lvl++) {
    const required = Math.round((50 / 3) * (Math.pow(lvl, 3) - 6 * Math.pow(lvl, 2) + 17 * lvl - 12));
    if (required > exp) return lvl - 1;
  }
  return 1000;
}

function getExpForLevel(level) {
  if (level <= 1) return 0;
  return Math.round((50 / 3) * (Math.pow(level, 3) - 6 * Math.pow(level, 2) + 17 * level - 12));
}

function getSkillLevel(tries, vocation, skillName) {
  const offset = skillName === "magic" ? 0 : 10;
  const A = SKILL_CONST[skillName] || 50;
  const vocationMulti = VOC_MULT[vocation] || VOC_MULT[0];
  const B = vocationMulti[skillName] || 1.5;
  return Math.floor(offset + (Math.log(tries * ((B - 1) / A) + 1) / Math.log(B)));
}

function getTriesForSkillLevel(targetLevel, vocation, skillName) {
  const offset = skillName === "magic" ? 0 : 10;
  const A = SKILL_CONST[skillName] || 50;
  const vocationMulti = VOC_MULT[vocation] || VOC_MULT[0];
  const B = vocationMulti[skillName] || 1.5;
  const x = targetLevel - offset;
  if (x <= 0) return 0;
  return Math.round(A * (Math.pow(B, x) - 1) / (B - 1));
}

// ─── DB operations ─────────────────────────────────────────────────────────

function getDb() {
  if (!db) {
    if (!fs.existsSync(DB_PATH)) {
      console.error("Database not found at:", DB_PATH);
      return null;
    }
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrate();
  }
  return db;
}

function migrate() {
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN last_ip TEXT DEFAULT NULL");
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec("ALTER TABLE accounts ADD COLUMN last_login INTEGER DEFAULT NULL");
  } catch (e) {
    // Column already exists
  }
}

function getAllCharacters() {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = d.prepare("SELECT id, account_id, name, data, created_at, updated_at FROM characters ORDER BY name").all();
    return rows.map(function (row) {
      try {
        const parsed = JSON.parse(row.data);
        const props = parsed.properties || {};
        const skills = parsed.skills || {};
        const vocation = props.vocation || 0;
        const exp = skills.experience || 0;
        const level = getLevelFromExp(exp);

        return {
          id: row.id,
          account_id: row.account_id,
          name: row.name,
          level: level,
          vocation: vocation,
          sex: props.sex || 0,
          outfit: props.outfit || null,
          experience: exp,
          health: props.health || 150,
          maxHealth: props.healthMax || props.maxHealth || 150,
          mana: props.mana || 0,
          maxMana: props.manaMax || props.maxMana || 0,
          capacity: props.capacityMax || props.maxCapacity || props.capacity || 0,
          speed: props.speed || 0,
          skills: {
            magic: getSkillLevel(skills.magic || 0, vocation, "magic"),
            fist: getSkillLevel(skills.fist || 10, vocation, "fist"),
            club: getSkillLevel(skills.club || 10, vocation, "club"),
            sword: getSkillLevel(skills.sword || 10, vocation, "sword"),
            axe: getSkillLevel(skills.axe || 10, vocation, "axe"),
            distance: getSkillLevel(skills.distance || 10, vocation, "distance"),
            shielding: getSkillLevel(skills.shielding || 10, vocation, "shielding"),
            fishing: getSkillLevel(skills.fishing || 10, vocation, "fishing"),
            magicTries: skills.magic || 0,
            fistTries: skills.fist || 0,
            clubTries: skills.club || 0,
            swordTries: skills.sword || 0,
            axeTries: skills.axe || 0,
            distanceTries: skills.distance || 0,
            shieldingTries: skills.shielding || 0,
            fishingTries: skills.fishing || 0,
          },
          position: parsed.position || null,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      } catch (e) {
        return { id: row.id, name: row.name, error: "Invalid JSON data" };
      }
    });
  } catch (e) {
    console.error("Error querying characters:", e);
    return [];
  }
}

function getCharacterByName(name) {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.prepare("SELECT account_id, name, data FROM characters WHERE LOWER(name) = LOWER(?)").get(name.trim());
    if (!row) return null;
    const parsed = JSON.parse(row.data);
    const skills = parsed.skills || {};
    const props = parsed.properties || {};
    const vocation = props.vocation || 0;
    const exp = skills.experience || 0;

    return {
      account_id: row.account_id,
      name: row.name,
      level: getLevelFromExp(exp),
      vocation: vocation,
      skills: {
        magic: getSkillLevel(skills.magic || 0, vocation, "magic"),
        fist: getSkillLevel(skills.fist || 10, vocation, "fist"),
        club: getSkillLevel(skills.club || 10, vocation, "club"),
        sword: getSkillLevel(skills.sword || 10, vocation, "sword"),
        axe: getSkillLevel(skills.axe || 10, vocation, "axe"),
        distance: getSkillLevel(skills.distance || 10, vocation, "distance"),
        shielding: getSkillLevel(skills.shielding || 10, vocation, "shielding"),
        fishing: getSkillLevel(skills.fishing || 10, vocation, "fishing"),
      },
      data: parsed
    };
  } catch (e) {
    console.error("Error getting character:", e);
    return null;
  }
}

function updateCharacterData(name, updatedData) {
  const d = getDb();
  if (!d) return false;
  try {
    const row = d.prepare("SELECT account_id FROM characters WHERE LOWER(name) = LOWER(?)").get(name.trim());
    if (!row) return false;
    const result = d.prepare("UPDATE characters SET data = ?, updated_at = ? WHERE LOWER(name) = LOWER(?)")
      .run(JSON.stringify(updatedData), Date.now(), name.trim());
    if (result.changes > 0) {
      d.prepare("UPDATE accounts SET updated_at = ? WHERE id = ?").run(Date.now(), row.account_id);
    }
    return result.changes > 0;
  } catch (e) {
    console.error("Error updating character:", e);
    return false;
  }
}

function getTotalCharacterCount() {
  const d = getDb();
  if (!d) return 0;
  try {
    const row = d.prepare("SELECT COUNT(*) AS cnt FROM characters").get();
    return row ? row.cnt : 0;
  } catch (e) {
    return 0;
  }
}

function getTotalAccountCount() {
  const d = getDb();
  if (!d) return 0;
  try {
    const row = d.prepare("SELECT COUNT(*) AS cnt FROM accounts").get();
    return row ? row.cnt : 0;
  } catch (e) {
    return 0;
  }
}

function getAllAccounts() {
  const d = getDb();
  if (!d) return [];
  try {
    const rows = d.prepare(`
      SELECT a.id, a.name, a.group_id, a.ip, a.last_ip, a.last_login, a.created_at,
             c.name AS char_name
      FROM accounts a
      LEFT JOIN characters c ON c.account_id = a.id
      ORDER BY a.id
    `).all();
    const accMap = {};
    for (const row of rows) {
      if (!accMap[row.id]) {
        accMap[row.id] = {
          accountId: row.id,
          accountName: row.name || null,
          groupId: row.group_id,
          regIp: row.ip,
          lastIp: row.last_ip,
          lastLogin: row.last_login,
          createdAt: row.created_at,
          chars: []
        };
      }
      if (row.char_name) {
        accMap[row.id].chars.push(row.char_name);
      }
    }
    return Object.values(accMap);
  } catch (e) {
    console.error("Error querying accounts:", e);
    return [];
  }
}

function updateAccountLastIp(accountId, ip) {
  const d = getDb();
  if (!d) return false;
  try {
    d.prepare("UPDATE accounts SET last_ip = ?, last_login = ? WHERE id = ?")
      .run(ip, Date.now(), accountId);
    return true;
  } catch (e) {
    console.error("Error updating account last_ip:", e);
    return false;
  }
}

function getAccountCredentials(account) {
  const d = getDb();
  if (!d) return null;
  try {
    const row = d.prepare("SELECT id, hash, group_id FROM accounts WHERE LOWER(id) = LOWER(?)").get(account.trim());
    return row || null;
  } catch (e) {
    return null;
  }
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  getAllCharacters,
  getCharacterByName,
  updateCharacterData,
  getTotalCharacterCount,
  getTotalAccountCount,
  getAllAccounts,
  updateAccountLastIp,
  getAccountCredentials,
  getExpForLevel,
  getTriesForSkillLevel,
  close
};
