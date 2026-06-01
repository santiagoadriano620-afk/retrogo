/**
 * SQLite Helper Module
 * Ensures better-sqlite3 is properly installed and repaired if needed
 */

const { spawnSync, execSync } = require("child_process");
const path = require("path");

/**
 * Test if better-sqlite3 works by requiring it
 * @param {string} rootDir - Root directory where npm packages are
 * @returns {boolean} True if better-sqlite3 loads successfully
 */
function testBetterSqlite3(rootDir) {
  const result = spawnSync(process.execPath, ["-e", "require('better-sqlite3')"], {
    stdio: "ignore",
    cwd: rootDir
  });
  return result.status === 0;
}

/**
 * Repair better-sqlite3 installation
 * Attempts rebuild first, then full reinstall if needed
 * @param {string} rootDir - Root directory where npm packages are
 * @param {Function} log - Logger function
 * @throws {Error} If repair fails completely
 */
function repairBetterSqlite3(rootDir, log) {
  log("startup", "better-sqlite3 quebrado — reparando…");

  // Attempt 1: rebuild native modules
  spawnSync("npm", ["rebuild", "better-sqlite3"], {
    stdio: "inherit",
    shell: true,
    cwd: rootDir
  });

  if (testBetterSqlite3(rootDir)) {
    return;
  }

  // Attempt 2: full reinstall
  spawnSync("npm", ["install", "better-sqlite3"], {
    stdio: "inherit",
    shell: true,
    cwd: rootDir
  });

  if (!testBetterSqlite3(rootDir)) {
    throw new Error("Falha ao reparar better-sqlite3 após múltiplas tentativas");
  }
}

/**
 * Ensure better-sqlite3 is working, repair if necessary
 * @param {string} rootDir - Root directory where npm packages are
 * @param {Function} log - Logger function (receives 'startup' as service name)
 */
function ensureBetterSqlite3Works(rootDir, log) {
  if (testBetterSqlite3(rootDir)) {
    return;
  }

  repairBetterSqlite3(rootDir, log);
}

module.exports = {
  ensureBetterSqlite3Works,
  testBetterSqlite3,
  repairBetterSqlite3
};
