"use strict";

const path = require("path");
const { spawn, execSync, spawnSync } = require("child_process");
const os = require("os");

// ─── Config ──────────────────────────────────────────────────────────────────
const RESTART_DELAY = 1000;
const METRICS_INTERVAL = 30000;
const MAX_RESTARTS = 5;

// ─── Color helpers ───────────────────────────────────────────────────────────
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const clr = {
  bold:     (s) => c(1, s),
  dim:      (s) => c(2, s),
  green:    (s) => c(32, s),
  yellow:   (s) => c(33, s),
  red:      (s) => c(31, s),
  cyan:     (s) => c(36, s),
  magenta:  (s) => c(35, s),
  ok:       ()  => c(32, "✔"),
  fail:     ()  => c(31, "✘"),
  pending:  ()  => c(33, "⏳"),
};

const ROOT = __dirname;

const SERVICES = [
  { name: "Game Engine",    file: "engine.js",         port: 2223 },
  { name: "Login Server",   file: "login.js",          port: 8000 },
];

const LOG_PREFIX = {
  "Game Engine":   c(32,  "GAME"),
  "Login Server":  c(33,  "AUTH"),
  monit:           c(36,  "MONIT"),
  startup:         c(35,  "INIT"),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad(n)  { return String(n).padStart(2, "0"); }
function stamp() { const d = new Date(); return clr.dim(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`); }
function log(service, msg)  { console.log(` ${clr.dim("|")} ${stamp()} ${LOG_PREFIX[service] || clr.dim("???")} ${clr.dim("|")} ${msg}`); }

function fmtMs(ms) {
  if (ms < 1000) return ms + "ms";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  return m + "m " + (s % 60) + "s";
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / 1048576).toFixed(1) + "MB";
}

function fmtPct(v) {
  return (v).toFixed(1) + "%";
}

// ─── Port killer ─────────────────────────────────────────────────────────────
function killProcessOnPort(port) {
  try {
    if (process.platform === "win32") {
      const stdout = execSync(`netstat -ano | findstr /R /C:":${port} "`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" }); } catch { /* ok */ }
      }
      return pids.size;
    }
    const output = execSync(`lsof -ti:${port}`, { encoding: "utf8" });
    const pids = output.trim().split("\n").filter(Boolean);
    for (const pid of pids) {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return pids.length;
  } catch {
    return 0;
  }
}

// ─── SQLite repair ───────────────────────────────────────────────────────────
function ensureBetterSqlite3WorksOrRepair() {
  const r = () => spawnSync(process.execPath, ["-e", "require('better-sqlite3')"], { stdio: "ignore", cwd: path.join(ROOT, "engine") });
  if (r().status === 0) return;
  log("startup", clr.yellow("better-sqlite3 quebrado — reparando…"));
  spawnSync("npm", ["rebuild", "better-sqlite3"], { stdio: "inherit", shell: true, cwd: path.join(ROOT, "engine") });
  if (r().status === 0) return;
  spawnSync("npm", ["install", "better-sqlite3"], { stdio: "inherit", shell: true, cwd: path.join(ROOT, "engine") });
  if (r().status !== 0) {
    console.error(` ${clr.fail()} ${clr.red("Falha ao reparar better-sqlite3. Abortando.")}`);
    process.exit(1);
  }
}

// ─── Metrics (RSS + CPU per PID) ──────────────────────────────────────────────
function getProcessMetrics(pid) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }).trim();
      if (!out) return null;
      const parts = out.replace(/^"|"$/g, "").split('","');
      const memKb = parseInt(parts[parts.length - 1], 10);
      if (isNaN(memKb)) return null;
      return { rss: memKb * 1024, cpu: null };
    }
    const out = execSync(`ps -p ${pid} -o rss=,pcpu=`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
    if (!out) return null;
    const [rssKb, cpu] = out.split(/\s+/).map(Number);
    if (isNaN(rssKb)) return null;
    return { rss: rssKb * 1024, cpu };
  } catch {
    return null;
  }
}

function getSnapshot(records) {
  const snap = {};
  for (const service of SERVICES) {
    const r = records.get(service.name);
    if (!r || !r.proc || r.proc.killed) {
      snap[service.name] = null;
      continue;
    }
    const metrics = getProcessMetrics(r.proc.pid);
    snap[service.name] = {
      players: r.connectedPlayers,
      rss: metrics ? metrics.rss : 0,
      cpu: metrics ? metrics.cpu : null,
      uptime: Date.now() - r.startedAt,
    };
  }
  return snap;
}

function snapshotsEqual(a, b) {
  for (const key of Object.keys(a)) {
    if (a[key] === null && b[key] === null) continue;
    if (a[key] === null || b[key] === null) return false;
    if (a[key].players !== b[key].players) return false;
    if (Math.abs(a[key].rss - b[key].rss) > 1024 * 100) return false; // >100KB diff
    if (a[key].cpu !== null && b[key].cpu !== null && Math.abs(a[key].cpu - b[key].cpu) > 1) return false;
  }
  return true;
}

function snapshotToString(name, s) {
  if (!s) return `${name}: morto`;
  const parts = [`${s.players} player${s.players !== 1 ? "s" : ""}`];
  if (s.rss > 0) parts.push(`mem ${fmtBytes(s.rss)}`);
  if (s.cpu !== null) parts.push(`cpu ${fmtPct(s.cpu)}`);
  parts.push(`up ${fmtMs(s.uptime)}`);
  return `${name}: ${parts.join(", ")}`;
}

// ─── Process launcher ────────────────────────────────────────────────────────
const childRecords = new Map();
let shuttingDown = false;

function launch(service) {
  const old = childRecords.get(service.name);
  const restarts = old ? old.restarts : 0;

  const proc = spawn(process.execPath, [path.join(ROOT, "engine", service.file)], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const record = {
    proc, service, restarts,
    connectedPlayers: 0,
    startedAt: Date.now(),
  };

  proc.stdout.on("data", (buf) => {
    for (const line of buf.toString().trim().split("\n")) {
      if (/joined the server/i.test(line)) {
        record.connectedPlayers++;
      } else if (/closed|logout|disconnect/i.test(line)) {
        record.connectedPlayers = Math.max(0, record.connectedPlayers - 1);
      }
      log(service.name, line);
    }
  });

  proc.stderr.on("data", (buf) => {
    for (const line of buf.toString().trim().split("\n")) {
      log(service.name, clr.red(line));
    }
  });

  proc.on("error", (err) => {
    log(service.name, clr.red(`ERRO: ${err.message}`));
  });

  proc.on("exit", (code, signal) => {
    const uptime = Date.now() - record.startedAt;
    const reason = signal
      ? `sinal ${signal}`
      : `código ${code}`;
    log(service.name, clr.yellow(`morreu (${reason}) após ${fmtMs(uptime)}`));

    if (!shuttingDown && code !== 0 && code !== 42 && signal !== "SIGTERM") {
      if (record.restarts < MAX_RESTARTS) {
        record.restarts++;
        log(service.name, clr.yellow(`reiniciando (tentativa ${record.restarts}/${MAX_RESTARTS})…`));
        setTimeout(() => launch(service), RESTART_DELAY);
      } else {
        log(service.name, clr.red(`atingiu máximo de ${MAX_RESTARTS} reinícios — desistindo`));
      }
    }

    if (code === 42) {
      log(service.name, clr.red("Crash detectado — servidor não reinicia até revisão manual."));
      log(service.name, clr.red("1. Verifique database/crashes/ para o relatório de crash."));
      log(service.name, clr.red("2. Corrija o problema ou restaure um backup."));
      log(service.name, clr.red("3. Delete database/clean_shutdown se necessário."));
    }

    childRecords.delete(service.name);
  });

  childRecords.set(service.name, record);
  return proc;
}

// ─── Monitoring (metrics on change only) ─────────────────────────────────────
function startMonitoring() {
  let prev = null;

  setInterval(() => {
    const curr = getSnapshot(childRecords);
    if (!prev || !snapshotsEqual(prev, curr)) {
      const lines = [];
      for (const s of SERVICES) {
        lines.push(snapshotToString(s.name, curr[s.name]));
      }
      if (lines.length) {
        log("monit", clr.dim(lines.join("  ")));
      }
      prev = curr;
    }
  }, METRICS_INTERVAL);
}

// ─── Main ────────────────────────────────────────────────────────────────────
const BANNER = `
${clr.bold(clr.cyan("╔══════════════════════════════════════════════════════╗"))}
${clr.bold(clr.cyan("║"))}               ${clr.bold(clr.magenta("TIBIAJS SERVER"))}                ${clr.bold(clr.cyan("║"))}
${clr.bold(clr.cyan("║"))}          ${clr.dim("Modern Tibia 7.4 Engine")}            ${clr.bold(clr.cyan("║"))}
${clr.bold(clr.cyan("╚══════════════════════════════════════════════════════╝"))}
`;

console.log(BANNER);
console.log();

(async () => {
  const clearLine = () => { try { process.stdout.clearLine(); process.stdout.cursorTo(0); } catch {} };

  process.stdout.write(` ${clr.pending()} Liberando portas…`);
  const killed = [8000, 1337, 2223].reduce((sum, p) => sum + killProcessOnPort(p), 0);
  clearLine();
  console.log(` ${clr.ok()} Liberando portas  ${killed > 0 ? clr.dim(`(${killed} processo${killed > 1 ? "s" : ""} morto${killed > 1 ? "s" : ""})`) : clr.dim("(nenhum conflito)")}`);

  process.stdout.write(` ${clr.pending()} Verificando better-sqlite3…`);
  ensureBetterSqlite3WorksOrRepair();
  clearLine();
  console.log(` ${clr.ok()} better-sqlite3  ${clr.dim("ok")}`);

  console.log(` ${clr.pending()} Iniciando serviços…\n`);
  SERVICES.map(launch);

  for (const s of SERVICES) {
    log(s.name, clr.green("online"));
  }

  console.log(`\n ${clr.ok()} ${clr.bold("Todos os serviços rodando.")} ${clr.dim("Ctrl+C para desligar.")}\n`);

  startMonitoring();

  const shutdown = () => {
    shuttingDown = true;
    console.log(`\n ${clr.yellow("⏎ Desligando…")}`);
    for (const record of childRecords.values()) {
      if (!record.proc || record.proc.killed) continue;
      try { record.proc.kill("SIGTERM"); } catch { /* ok */ }
    }
    setTimeout(() => process.exit(0), 3000);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
