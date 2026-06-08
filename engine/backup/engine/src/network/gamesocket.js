"use strict";

const PacketBuffer = requireModule("network/packet-buffer");
const PacketReader = requireModule("network/packet-reader");

const {
  LatencyPacket,
  ServerErrorPacket,
  PlayerLoginPacket,
  WorldTimePacket,
  PlayerStatePacket,
  ServerStatePacket,
  PlayerInfoPacket,
  ContainerAddPacket,
  IgnoreDataPacket,
  GlobalBoostUpdatePacket
} = requireModule("network/protocol");

const GameSocket = function (socket, account, xorKey) {

  /*
   * Class GameSocket
   * Wrapper for a websocket that is connected to the gameserver
   */

  // Wrap the websocket
  this.socket = socket;
  this.account = account;

  // Each websocket should reference a player in the gameworld
  this.player = null;
  this.__controller = false;

  // Premium account expiry timestamp (0 = no premium)
  this.premiumExpiry = 0;

  // Keep the address
  this.__address = this.getAddress().address;

  // Time of initial connection
  this.__connected = Date.now();

  // State variable to kick inactive sockets that no longer respond
  this.__alive = true;

  // Buffer incoming & outgoing messages are read and send once per server tick
  this.incomingBuffer = new PacketBuffer();
  this.outgoingBuffer = new PacketBuffer();

  // Rate limiting: track packets in current window
  this.__packetTimestamps = [];
  this.__rateLimitMax = 60;
  this.__rateLimitWindow = 1000;

  // XOR encryption key for this session (8 bytes, may be null if disabled)
  this.__xorKey = xorKey;

  // Device type derived from User-Agent (desktop, mobile, tablet, tv)
  this.__deviceType = null;

  // Attach the socket listeners
  this.socket.on("message", this.__handleSocketData.bind(this));
  this.socket.on("error", this.__handleSocketError.bind(this));
  this.socket.on("pong", this.__handlePong.bind(this));

}

GameSocket.prototype.getBytesWritten = function () {

  /*
   * Function WebsocketServer.getSocketDetails
   * Returns sent and received bytes for a socket
   */

  return this.socket._socket.bytesWritten;

}

GameSocket.prototype.getBytesRead = function () {

  /*
   * Function WebsocketServer.getSocketDetails
   * Returns sent and received bytes for a socket
   */

  return this.socket._socket.bytesRead;

}

GameSocket.prototype.isPremium = function () {

  /*
   * Function GameSocket.isPremium
   * Returns true if this account has premium status
   */

  if (CONFIG.GAME.FREE_PREMIUM) return true;
  return this.premiumExpiry > Date.now();

}

GameSocket.prototype.__handleSocketError = function (gameSocket) {

  /*
   * Function WebsocketServer.__handleSocketError
   * Delegates to the close socket handler
   */

  this.close();

}

GameSocket.prototype.__handlePong = function (gameSocket) {

  /*
   * Function GameSocket.__handlePong
   * Updates the state for the ping/pong
   */

  this.__alive = true;

}

GameSocket.prototype.isController = function () {

  /*
   * Function GameSocket.isController
   * Returns true if the game socket is controlling the player 
   */

  // This is possible
  if (this.player === null) {
    return false;
  }

  return this === this.player.socketHandler.getController();

}

GameSocket.prototype.getLastPacketReceived = function () {

  /*
   * Function GameSocket.getLastPacketReceived
   * Returns the timestamp of when the latest packet was received 
   */

  return this.incomingBuffer.__lastPacketReceived;

}

GameSocket.prototype.writeLatencyPacket = function () {

  /*
   * Function GameSocket.writeLatencyPacket
   * Latency requests are not subject to buffering: go to the socket
   */

  let buffer = new LatencyPacket().getBuffer();
  this.socket.send(this.__xorBuffer(buffer));

}

GameSocket.prototype.isAlive = function () {

  /*
   * Function GameSocket.isAlive
   * Returns true if the gamesocket is still alive and responds to the ping-pong game
   */

  return this.__alive;

}

GameSocket.prototype.ping = function () {

  /*
   * Function GameSocket.ping
   * Requests a pong from the gamesocket
   */

  // Not alive from previous ping: bye bye
  if (!this.isAlive()) {
    return this.terminate();
  }

  // Set to not being alive: will be set to alive after receiving the pong
  this.__alive = false;

  // Send a ping
  this.socket.ping();

}

GameSocket.prototype.id = function () {

  return this.socket._socket.id;

}

GameSocket.prototype.getAddress = function () {

  /*
   * Function GameSocket.getAddress
   * Returns IPV4,6 address parameters from the wrapped socket
   */

  return this.socket._socket.address();

}


GameSocket.prototype.serializeWorld = function (chunk) {

  /*
   * Function GameSocket.serializeWorld
   * Serializes the visible world chunks around the spectated player
   */

  // Serializes chunks within 8 chunks distance (17x17 grid)
  let serialized = new Set();
  let queue = [chunk];
  serialized.add(chunk.id);

  let cx = chunk.position.x;
  let cy = chunk.position.y;

  while (queue.length > 0) {
    let current = queue.shift();
    current.serialize(this);
    current.neighbours.forEach(n => {
      if (!serialized.has(n.id) && Math.max(Math.abs(n.position.x - cx), Math.abs(n.position.y - cy)) <= 3) {
        serialized.add(n.id);
        queue.push(n);
      }
    });
  }

}

GameSocket.prototype.writeWorldState = function (player) {

  /*
   * Function GameSocket.writeWorldState
   * Writes the spectator login packets to the gameSocket for a particular player that describes the state of the game world
   */

  // Write the required server data to the client
  this.write(new ServerStatePacket());

  // Write the friend list
  //player.friendlist.writeFriendList(gameSocket);

  // Serialize the game world on request
  this.serializeWorld(player.getChunk());

  this.write(new PlayerStatePacket(player));

  const { BlessingUpdatePacket } = requireModule("network/protocol");
  this.write(new BlessingUpdatePacket(player.getBlessingBitmask(), player.isPremium()));

  this.write(new WorldTimePacket(gameServer.world.clock.getTime()));

  // Inform everyone of the new player
  gameServer.world.broadcastPacket(new PlayerLoginPacket(player.getProperty(CONST.PROPERTIES.NAME)));

  // Write the player spells
  player.spellbook.writeSpells(this);

  // Write the ignore list
  this.write(new IgnoreDataPacket(player.ignorelist.getList()));

  // Write global boost state
  var expExpiry = Math.floor(gameServer.globalBoosts.exp / 1000);
  var lootExpiry = Math.floor(gameServer.globalBoosts.loot / 1000);
  var skillsExpiry = Math.floor(gameServer.globalBoosts.skills / 1000);
  this.write(new GlobalBoostUpdatePacket(expExpiry, lootExpiry, skillsExpiry));

  // Adjust skill display for any equipped ring with bonuses
  if (player.__resendAllRingSkills) {
    player.__resendAllRingSkills();
  }
}

GameSocket.prototype.attachPlayerController = function (player) {

  /*
   * Function Player.attachPlayerController
   * Attaches a gamesocket controller to the player that is allowed to control the player
   */

  // Set state that this gamesocket is a controller
  this.__controller = true;

  // Attach a controller
  player.attachController(this);

}

GameSocket.prototype.__isLatencyRequest = function (buffer) {

  /*
   * Function WebsocketServer.__isLatencyRequest
   * Returns true if the message is a latency request
   */

  return buffer.length === 1 && buffer[0] === CONST.PROTOCOL.CLIENT.LATENCY;

}

GameSocket.prototype.__xorBuffer = function (buffer) {
  if (!this.__xorKey) return buffer;
  let result = Buffer.allocUnsafe(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    result[i] = buffer[i] ^ this.__xorKey[i % this.__xorKey.length];
  }
  return result;
}

GameSocket.prototype.__handleSocketData = function (buffer) {

  /*
   * Function GameSocket.__handleSocketData
   * Handles incoming socket data
   */

  // String data — ignore (CAM removed)
  if (typeof buffer === "string") {
    return;
  }

  // Array buffer was not received
  if (!Buffer.isBuffer(buffer)) {
    return this.close();
  }

  // Decrypt the incoming buffer (latency packet is also XORed from client)
  buffer = this.__xorBuffer(buffer);

  // If latency request do not buffer: immediately write the response
  if (this.__isLatencyRequest(buffer)) {
    return this.writeLatencyPacket();
  }

  // Only player controllers may interact with the server
  if (!this.isController()) {
    return;
  }

  // Rate limiting: check packet flood (max 20 per second)
  let now = Date.now();
  this.__packetTimestamps = this.__packetTimestamps.filter(t => now - t < this.__rateLimitWindow);
  if (this.__packetTimestamps.length >= this.__rateLimitMax) {
    return this.closeError("Too many packets. Connection closed.");
  }
  this.__packetTimestamps.push(now);

  // Buffer the incoming message. The buffers are read once per server tick
  this.incomingBuffer.add(buffer);

}

GameSocket.prototype.closeError = function (message) {

  /*
   * Function GameSocket.closeError
   * Closes the game socket with a particular error
   */

  this.socket.send(new ServerErrorPacket(message).getBuffer());

  // Gracefully close
  this.close();

}

GameSocket.prototype.write = function (packet) {

  /*
   * Function GameSocket.write
   * Writes a message to the outgoing buffer
   */

  // Exceeds the maximum size: disconnect the game socket for safety
  if (packet.overflow()) {
    return this.closeError("Internal server error: game packet overflow.");
  }

  // Add it
  this.outgoingBuffer.add(packet.getBuffer());

}

GameSocket.prototype.terminate = function () {

  /*
   * Function GameSocket.terminate
   * Terminates the websocket
   */

  this.socket.terminate();

}

GameSocket.prototype.close = function () {

  /*
   * Function GameSocket.close
   * Closes the websocket and cleans up listeners
   */

  this.socket.removeAllListeners("message");
  this.socket.removeAllListeners("error");
  this.socket.removeAllListeners("pong");
  this.socket.close();

}

module.exports = GameSocket;
