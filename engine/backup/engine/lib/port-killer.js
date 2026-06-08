/**
 * Port Killer Module
 * Utility to kill processes running on specific ports (cross-platform)
 */

const { execSync } = require("child_process");

/**
 * Kill all processes bound to a specific port
 * @param {number} port - Port number to free
 * @returns {number} Number of processes killed
 */
function killProcessOnPort(port) {
  try {
    if (process.platform === "win32") {
      return killOnWindows(port);
    } else {
      return killOnUnix(port);
    }
  } catch {
    return 0;
  }
}

function killOnWindows(port) {
  try {
    const stdout = execSync(`netstat -ano | findstr /R /C:":${port} "`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });

    const pids = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) {
        pids.add(pid);
      }
    }

    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } catch {
        // Process already killed
      }
    }

    return pids.size;
  } catch {
    return 0;
  }
}

function killOnUnix(port) {
  try {
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

module.exports = {
  killProcessOnPort
};
