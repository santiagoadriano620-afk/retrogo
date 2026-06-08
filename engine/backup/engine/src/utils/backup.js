"use strict";

const fs = require("fs");
const path = require("path");

const BACKUP_DIR = path.resolve(__dirname, "..", "..", "..", "data", "database", "backups");

const BackupManager = function (database) {
  this.db = database;
  this.lastBackupTime = 0;
};

BackupManager.prototype.ensureDir = function () {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

BackupManager.prototype.getBackupPath = function () {
  var now = new Date();
  var year = now.getFullYear();
  var month = String(now.getMonth() + 1).padStart(2, "0");
  var day = String(now.getDate()).padStart(2, "0");
  var hour = String(now.getHours()).padStart(2, "0");
  var min = String(now.getMinutes()).padStart(2, "0");
  var sec = String(now.getSeconds()).padStart(2, "0");

  var dir = path.join(BACKUP_DIR,
    String(year) + "-" + month + "-" + day
  );

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return path.join(dir, hour + "-" + min + "-" + sec + ".db");
};

BackupManager.prototype.createBackup = function () {
  try {
    this.ensureDir();
    var backupPath = this.getBackupPath();

    this.db.backup(backupPath);

    this.lastBackupTime = Date.now();
    return backupPath;
  } catch (e) {
    console.error("Backup failed:", e.message);
    return null;
  }
};

BackupManager.prototype.getLatestBackup = function () {
  this.ensureDir();
  var latest = null;
  var latestTime = 0;

  try {
    var dateDirs = fs.readdirSync(BACKUP_DIR);
    for (var i = 0; i < dateDirs.length; i++) {
      var dateDir = path.join(BACKUP_DIR, dateDirs[i]);
      var stat = fs.statSync(dateDir);
      if (!stat.isDirectory()) continue;

      var files = fs.readdirSync(dateDir);
      for (var j = 0; j < files.length; j++) {
        if (!files[j].endsWith(".db")) continue;
        var filePath = path.join(dateDir, files[j]);
        var mtime = fs.statSync(filePath).mtimeMs;
        if (mtime > latestTime) {
          latestTime = mtime;
          latest = filePath;
        }
      }
    }
  } catch (e) {
    console.error("Error finding latest backup:", e.message);
  }

  return latest;
};

module.exports = BackupManager;
