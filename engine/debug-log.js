const fs = require('fs');
const path = require('path');

const LOG_FILE = path.resolve(__dirname, '..', 'output.txt');
const MAX_LINE_LENGTH = 500;

function ts() {
  let d = new Date();
  return d.toISOString().slice(11, 23);
}

function truncate(s) {
  let str = typeof s === 'string' ? s : String(s);
  return str.length > MAX_LINE_LENGTH ? str.slice(0, MAX_LINE_LENGTH) + '...' : str;
}

let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  fs.writeFileSync(LOG_FILE, '', 'utf8');
  write('[DEBUG-LOG] Started');
}

function write(msg) {
  init();
  try {
    fs.appendFileSync(LOG_FILE, `[${ts()}] ${truncate(msg)}\n`, 'utf8');
  } catch (e) {
    // silently fail
  }
}

// Hook server packet writes
function hookServer() {
  init();
  write('[DEBUG-LOG] Server hooks installed');

  const gamesocket = require('./src/network/gamesocket');
  const origWrite = gamesocket.GameSocket.prototype.write;
  gamesocket.GameSocket.prototype.write = function (packet) {
    let packetName = packet.constructor ? packet.constructor.name : 'unknown';
    let msg = `[S->C] ${packetName}`;

    // Enrich with details for important packets
    if (packet.constructor.name === 'CreatureMovePacket') {
      try {
        msg += ` id=${packet.creatureId} pos=(${packet.toPosition.x},${packet.toPosition.y},${packet.toPosition.z})`;
      } catch (e) {}
    } else if (packet.constructor.name === 'ContainerAddPacket') {
      try {
        msg += ` container=${packet.guid} slot=${packet.slot}`;
      } catch (e) {}
    } else if (packet.constructor.name === 'ContainerRemovePacket') {
      try {
        msg += ` container=${packet.guid} slot=${packet.slot}`;
      } catch (e) {}
    } else if (packet.constructor.name === 'CreatureStatePacket') {
      try {
        msg += ` id=${packet.creatureId}`;
      } catch (e) {}
    } else if (packet.constructor.name === 'TileUpdatePacket') {
      try {
        msg += ` pos=(${packet.x},${packet.y},${packet.z})`;
      } catch (e) {}
    }

    write(msg);
    return origWrite.call(this, packet);
  };

  // Hook server broadcast
  const worldCreatureHandler = require('./src/core/world-creature-handler');
  // Actually, we need to hook the broadcast mechanism
  const origBroadcast = require('./src/game/gameserver').GameServer.prototype.broadcast;
  if (origBroadcast) {
    require('./src/game/gameserver').GameServer.prototype.broadcast = function (packet, except) {
      let packetName = packet.constructor ? packet.constructor.name : 'unknown';
      write(`[S->ALL] ${packetName}${except ? ' (except id=' + except + ')' : ''}`);
      return origBroadcast.call(this, packet, except);
    };
  }
}

// Hook client packet receives (called via fetch from browser)
const http = require('http');
function serveClientLogs(server) {
  // Hook into existing HTTP server
  if (!server) return;
  server.on('request', (req, res) => {
    if (req.url === '/__debug_log' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          let data = JSON.parse(body);
          write(`[C] ${data.msg}`);
        } catch (e) {
          write(`[C] (parse error) ${truncate(body)}`);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });
    }
  });
  write('[DEBUG-LOG] Client log endpoint ready at /__debug_log');
}

module.exports = { write, hookServer, serveClientLogs };
