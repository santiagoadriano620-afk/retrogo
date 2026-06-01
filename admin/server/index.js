"use strict";

const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const db = require("./lib/database");
const pm = require("./lib/process-manager");

const PORT = parseInt(process.env.ADMIN_PANEL_PORT || "3000", 10);
const IS_PROD = process.env.NODE_ENV === "production" || process.env.DEV_MODE === "false";

// Load SESSION_SECRET from engine's .env as fallback
function loadSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  try {
    const envPath = path.resolve(__dirname, "..", "..", "engine", ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      const match = content.match(/^SESSION_SECRET=(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch (e) { /* ignore */ }
  return null;
}

const SESSION_SECRET = loadSessionSecret();
if (!SESSION_SECRET || SESSION_SECRET.startsWith("CHANGE_ME")) {
  console.error("[FATAL] SESSION_SECRET not configured. Add SESSION_SECRET to engine/.env");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: IS_PROD ? process.env.ADMIN_PANEL_ORIGIN || "http://localhost:3000" : "*",
    credentials: true
  }
});

app.use(cors({
  origin: IS_PROD ? process.env.ADMIN_PANEL_ORIGIN || "http://localhost:3000" : true,
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const { requireAdmin } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const playersRoutes = require("./routes/players");
const serverRoutes = require("./routes/server");
const spritesRoutes = require("./routes/sprites");
const mccheckRoutes = require("./routes/mccheck");
const paymentsRoutes = require("./routes/payments");

app.use("/api/admin", authRoutes);
app.use("/api/admin/dashboard", requireAdmin, dashboardRoutes);
app.use("/api/admin/players", requireAdmin, playersRoutes);
app.use("/api/admin/server", requireAdmin, serverRoutes);
app.use("/api/admin/sprites", spritesRoutes);
app.use("/api/admin/mccheck", requireAdmin, mccheckRoutes);
app.use("/api/payments", paymentsRoutes);

app.use(express.static(path.join(__dirname, "..", "client", "dist")));
app.get("*", function (req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "..", "client", "dist", "index.html"));
});

pm.setLogCallback(function (level, msg) {
  io.emit("terminal", { level: level, message: msg, timestamp: Date.now() });
});

io.on("connection", function (socket) {
  socket.emit("terminal", {
    level: "info",
    message: "=== Admin Panel Connected ===",
    timestamp: Date.now()
  });

  const status = pm.getStatus();
  socket.emit("server-status", status);
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("Admin panel server running on http://0.0.0.0:" + PORT);
});

process.on("SIGINT", function () {
  db.close();
  process.exit(0);
});

process.on("SIGTERM", function () {
  db.close();
  process.exit(0);
});
