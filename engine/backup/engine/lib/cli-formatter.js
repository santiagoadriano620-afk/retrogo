/**
 * CLI Formatter Module
 * Provides ANSI color codes, formatting utilities, and logging helpers
 */

const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;

const colors = {
  bold:     (s) => c(1, s),
  dim:      (s) => c(2, s),
  green:    (s) => c(32, s),
  yellow:   (s) => c(33, s),
  red:      (s) => c(31, s),
  cyan:     (s) => c(36, s),
  magenta:  (s) => c(35, s),
};

const symbols = {
  ok:       () => c(32, "✔"),
  fail:     () => c(31, "✘"),
  pending:  () => c(33, "⏳"),
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function timestamp() {
  const d = new Date();
  return colors.dim(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
}

function formatMs(ms) {
  if (ms < 1000) return ms + "ms";
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + "s";
  const m = Math.floor(s / 60);
  return m + "m " + (s % 60) + "s";
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / 1048576).toFixed(1) + "MB";
}

function formatPercent(v) {
  return (v).toFixed(1) + "%";
}

function createLogger(logPrefixes) {
  return function log(service, msg) {
    const prefix = logPrefixes[service] || colors.dim("???");
    console.log(` ${colors.dim("|")} ${timestamp()} ${prefix} ${colors.dim("|")} ${msg}`);
  };
}

module.exports = {
  colors,
  symbols,
  pad,
  timestamp,
  formatMs,
  formatBytes,
  formatPercent,
  createLogger
};
