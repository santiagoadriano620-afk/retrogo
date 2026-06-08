/**
 * Process Manager Module
 * Handles launching, monitoring, and restarting child processes with metrics
 */

const path = require("path");
const { spawn, execSync } = require("child_process");
const os = require("os");

const CONFIG = {
  RESTART_DELAY: 1000,
  METRICS_INTERVAL: 30000,
  MAX_RESTARTS: 5
};

/**
 * Get process metrics (RSS memory and CPU usage)
 * Works cross-platform (Windows and Unix)
 * @param {number} pid - Process ID
 * @returns {Object|null} { rss: bytes, cpu: percent } or null if unavailable
 */
function getProcessMetrics(pid) {
  try {
    if (process.platform === "win32") {
      return getMetricsWindows(pid);
    } else {
      return getMetricsUnix(pid);
    }
  } catch {
    return null;
  }
}

function getMetricsWindows(pid) {
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

function getMetricsUnix(pid) {
  const out = execSync(`ps -p ${pid} -o rss=,pcpu=`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 3000,
  }).trim();

  if (!out) return null;

  const [rssKb, cpu] = out.split(/\s+/).map(Number);
  if (isNaN(rssKb)) return null;

  return { rss: rssKb * 1024, cpu };
}

/**
 * Create a process launcher function
 * @param {Object} options - { rootDir, services, log, formatters }
 * @returns {Function} launch(service) function
 */
function createLauncher(options) {
  const { rootDir, services, log, formatters } = options;
  const childRecords = new Map();
  let shuttingDown = false;

  function launch(service) {
    const old = childRecords.get(service.name);
    const restarts = old ? old.restarts : 0;

    const proc = spawn(process.execPath, [path.join(rootDir, service.file)], {
      cwd: path.resolve(rootDir, ".."),
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
        log(service.name, formatters.colors.red(line));
      }
    });

    proc.on("error", (err) => {
      log(service.name, formatters.colors.red(`ERRO: ${err.message}`));
    });

    proc.on("exit", (code, signal) => {
      const uptime = Date.now() - record.startedAt;
      const reason = signal
        ? `sinal ${signal}`
        : `código ${code}`;
      log(service.name, formatters.colors.yellow(`morreu (${reason}) após ${formatters.formatMs(uptime)}`));

      if (!shuttingDown && code !== 0 && code !== 42 && signal !== "SIGTERM") {
        if (record.restarts < CONFIG.MAX_RESTARTS) {
          record.restarts++;
          log(service.name, formatters.colors.yellow(`reiniciando (tentativa ${record.restarts}/${CONFIG.MAX_RESTARTS})…`));
          setTimeout(() => launch(service), CONFIG.RESTART_DELAY);
        } else {
          log(service.name, formatters.colors.red(`atingiu máximo de ${CONFIG.MAX_RESTARTS} reinícios — desistindo`));
        }
      }

      if (code === 42) {
        log(service.name, formatters.colors.red("Crash detectado — servidor não reinicia até revisão manual."));
        log(service.name, formatters.colors.red("1. Verifique database/crashes/ para o relatório de crash."));
        log(service.name, formatters.colors.red("2. Corrija o problema ou restaure um backup."));
        log(service.name, formatters.colors.red("3. Delete database/clean_shutdown se necessário."));
      }

      childRecords.delete(service.name);
    });

    childRecords.set(service.name, record);
    return proc;
  }

  function getSnapshot() {
    const snap = {};
    for (const service of services) {
      const r = childRecords.get(service.name);
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

  function startMonitoring() {
    let prev = null;

    setInterval(() => {
      const curr = getSnapshot();
      if (!prev || !snapshotsEqual(prev, curr)) {
        const lines = [];
        for (const s of services) {
          lines.push(snapshotToString(s.name, curr[s.name], formatters));
        }
        if (lines.length) {
          log("monit", formatters.colors.dim(lines.join("  ")));
        }
        prev = curr;
      }
    }, CONFIG.METRICS_INTERVAL);
  }

  function shutdown() {
    shuttingDown = true;
    console.log(`\n ${formatters.colors.yellow("⏎ Desligando…")}`);
    for (const record of childRecords.values()) {
      if (!record.proc || record.proc.killed) continue;
      try { record.proc.kill("SIGTERM"); } catch { /* ok */ }
    }
    setTimeout(() => process.exit(0), 3000);
  }

  return { launch, startMonitoring, shutdown, getSnapshot };
}

function snapshotsEqual(a, b) {
  for (const key of Object.keys(a)) {
    if (a[key] === null && b[key] === null) continue;
    if (a[key] === null || b[key] === null) return false;
    if (a[key].players !== b[key].players) return false;
    if (Math.abs(a[key].rss - b[key].rss) > 1024 * 100) return false;
    if (a[key].cpu !== null && b[key].cpu !== null && Math.abs(a[key].cpu - b[key].cpu) > 1) return false;
  }
  return true;
}

function snapshotToString(name, s, formatters) {
  if (!s) return `${name}: morto`;
  const parts = [`${s.players} player${s.players !== 1 ? "s" : ""}`];
  if (s.rss > 0) parts.push(`mem ${formatters.formatBytes(s.rss)}`);
  if (s.cpu !== null) parts.push(`cpu ${formatters.formatPercent(s.cpu)}`);
  parts.push(`up ${formatters.formatMs(s.uptime)}`);
  return `${name}: ${parts.join(", ")}`;
}

module.exports = {
  createLauncher,
  getProcessMetrics,
  CONFIG
};
