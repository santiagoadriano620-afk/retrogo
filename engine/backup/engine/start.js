"use strict";

const path = require("path");

// Import modularized components
const formatter = require("./lib/cli-formatter");
const { killProcessOnPort } = require("./lib/port-killer");
const { ensureBetterSqlite3Works } = require("./lib/sqlite-helper");
const { createLauncher } = require("./lib/process-manager");

const ROOT = __dirname;

const SERVICES = [
  { name: "Game Engine", file: "engine.js", port: 2223 },
  { name: "Login Server", file: "login.js", port: 8000 },
];

const LOG_PREFIXES = {
  "Game Engine": formatter.colors.green("GAME"),
  "Login Server": formatter.colors.yellow("AUTH"),
  monit: formatter.colors.cyan("MONIT"),
  startup: formatter.colors.magenta("INIT"),
};

const log = formatter.createLogger(LOG_PREFIXES);

const BANNER = `
${formatter.colors.bold(formatter.colors.cyan("╔══════════════════════════════════════════════════════╗"))}
${formatter.colors.bold(formatter.colors.cyan("║"))}               ${formatter.colors.bold(formatter.colors.magenta("TIBIAJS SERVER"))}                ${formatter.colors.bold(formatter.colors.cyan("║"))}
${formatter.colors.bold(formatter.colors.cyan("║"))}          ${formatter.colors.dim("Modern Tibia 7.4 Engine")}            ${formatter.colors.bold(formatter.colors.cyan("║"))}
${formatter.colors.bold(formatter.colors.cyan("╚══════════════════════════════════════════════════════╝"))}
`;

console.log(BANNER);
console.log();

(async () => {
  const clearLine = () => {
    try {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
    } catch { /* ok */ }
  };

  // Step 1: Free ports from any lingering processes
  process.stdout.write(` ${formatter.symbols.pending()} Liberando portas…`);
  const killed = [8000, 1337, 2223].reduce((sum, p) => sum + killProcessOnPort(p), 0);
  clearLine();
  console.log(
    ` ${formatter.symbols.ok()} Liberando portas  ${
      killed > 0
        ? formatter.colors.dim(`(${killed} processo${killed > 1 ? "s" : ""} morto${killed > 1 ? "s" : ""})`)
        : formatter.colors.dim("(nenhum conflito)")
    }`
  );

  // Step 2: Ensure better-sqlite3 is working
  process.stdout.write(` ${formatter.symbols.pending()} Verificando better-sqlite3…`);
  try {
    ensureBetterSqlite3Works(ROOT, log);
    clearLine();
    console.log(` ${formatter.symbols.ok()} better-sqlite3  ${formatter.colors.dim("ok")}`);
  } catch (err) {
    clearLine();
    console.error(` ${formatter.symbols.fail()} ${formatter.colors.red("Falha ao reparar better-sqlite3.")}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }

  // Step 3: Create process manager and start services
  console.log(` ${formatter.symbols.pending()} Iniciando serviços…\n`);

  const manager = createLauncher({
    rootDir: ROOT,
    services: SERVICES,
    log,
    formatters: formatter
  });

  SERVICES.forEach(manager.launch);

  for (const s of SERVICES) {
    log(s.name, formatter.colors.green("online"));
  }

  console.log(
    `\n ${formatter.symbols.ok()} ${formatter.colors.bold("Todos os serviços rodando.")} ${formatter.colors.dim(
      "Ctrl+C para desligar."
    )}\n`
  );

  // Start monitoring metrics
  manager.startMonitoring();

  // Setup graceful shutdown
  process.on("SIGINT", manager.shutdown);
  process.on("SIGTERM", manager.shutdown);
})();
