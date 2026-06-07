"use strict";

const PacketWriter = requireModule("network/packet-writer");

const CreaturePropertyPacket = function (id, property, value) {
  /*
   * Class CreaturePropertyPacket
   * Wrapper for a packet that describes a property change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CREATURE_PROPERTY, 9);

  // Three properties
  this.writeUInt32(id);
  this.writeUInt8(property);
  this.writeUInt32(value);
};

CreaturePropertyPacket.prototype = Object.create(PacketWriter.prototype);
CreaturePropertyPacket.prototype.constructor = CreaturePropertyPacket;

const StringCreaturePropertyPacket = function (id, property, string) {
  /*
   * Class CreaturePropertyPacket
   * Wrapper for a packet that describes a property change
   */

  let stringEncoded = this.encodeString(string);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CREATURE_PROPERTY,
    stringEncoded.getEncodedLength() + 5
  );

  // Three properties
  this.writeUInt32(id);
  this.writeUInt8(property);
  this.writeBuffer(stringEncoded);
};

StringCreaturePropertyPacket.prototype = Object.create(PacketWriter.prototype);
StringCreaturePropertyPacket.prototype.constructor =
  StringCreaturePropertyPacket;

const OutfitPacket = function (guid, outfit) {
  /*
   * Class OutfitPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.OUTFIT, 15);

  // Write the identifier of the creature & new outfit
  this.writeUInt32(guid);
  this.writeOutfit(outfit);
};

OutfitPacket.prototype = Object.create(PacketWriter.prototype);
OutfitPacket.prototype.constructor = OutfitPacket;

const EmotePacket = function (creature, message, color) {
  /*
   * Class EmotePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Strings with variable length
  let stringEncoded = this.encodeString(message);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.EMOTE,
    6 + stringEncoded.getEncodedLength()
  );

  // Write creature information
  this.writeUInt32(creature.getId());
  this.writeUInt8(creature.type);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(color);
};

EmotePacket.prototype = Object.create(PacketWriter.prototype);
EmotePacket.prototype.constructor = EmotePacket;

const ChannelDefaultPacket = function (creature, message, color) {
  /*
   * Class ChannelDefaultPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Strings with variable length
  let stringEncoded = this.encodeString(message);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CREATURE_SAY,
    6 + stringEncoded.getEncodedLength()
  );

  // Write creature information
  this.writeUInt32(creature.getId());
  this.writeUInt8(creature.type);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(color);
};

ChannelDefaultPacket.prototype = Object.create(PacketWriter.prototype);
ChannelDefaultPacket.prototype.constructor = ChannelDefaultPacket;

const EffectMagicPacket = function (position, type) {
  /*
   * Class EffectMagicPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.MAGIC_EFFECT, 7);

  // Properties
  this.writePosition(position);
  this.writeUInt8(type);
};

EffectMagicPacket.prototype = Object.create(PacketWriter.prototype);
EffectMagicPacket.prototype.constructor = EffectMagicPacket;

const EffectDistancePacket = function (positionFrom, positionTo, type) {
  /*
   * Class EffectMagicPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.DISTANCE_EFFECT, 13);

  // Properties
  this.writePosition(positionFrom);
  this.writePosition(positionTo);
  this.writeUInt8(type);
};

EffectDistancePacket.prototype = Object.create(PacketWriter.prototype);
EffectDistancePacket.prototype.constructor = EffectDistancePacket;

const PlayerLoginPacket = function (name) {
  /*
   * Class PlayerLoginPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Strings with variable length
  let stringEncoded = this.encodeString(name);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.PLAYER_LOGIN,
    stringEncoded.getEncodedLength()
  );

  // Write the property
  this.writeBuffer(stringEncoded);
};

PlayerLoginPacket.prototype = Object.create(PacketWriter.prototype);
PlayerLoginPacket.prototype.constructor = PlayerLoginPacket;

const PlayerLogoutPacket = function (name) {
  /*
   * Class PlayerLogoutPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Strings with variable length
  let stringEncoded = this.encodeString(name);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.PLAYER_LOGOUT,
    stringEncoded.getEncodedLength()
  );

  // Write the property
  this.writeBuffer(stringEncoded);
};

PlayerLogoutPacket.prototype = Object.create(PacketWriter.prototype);
PlayerLogoutPacket.prototype.constructor = PlayerLogoutPacket;

const CreatureMovePacket = function (guid, position, duration) {
  /*
   * Class CreatureMovePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CREATURE_MOVE, 12);

  this.writeUInt32(guid);
  this.writePosition(position);
  this.writeUInt16(duration);

  this.__debugStr = `id=${guid} to=(${position.x},${position.y},${position.z}) dur=${duration}`;
};

CreatureMovePacket.prototype = Object.create(PacketWriter.prototype);
CreatureMovePacket.prototype.constructor = CreatureMovePacket;

const CreatureTeleportPacket = function (guid, position) {
  /*
   * Class CreatureTeleportPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CREATURE_TELEPORT, 10);

  this.writeUInt32(guid);
  this.writePosition(position);

  this.__debugStr = `id=${guid} to=(${position.x},${position.y},${position.z})`;
};

CreatureTeleportPacket.prototype = Object.create(PacketWriter.prototype);
CreatureTeleportPacket.prototype.constructor = CreatureTeleportPacket;

const ServerMessagePacket = function (message) {
  /*
   * Class ServerMessagePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Strings with variable length
  let stringEncoded = this.encodeString(message);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.MESSAGE_SERVER,
    stringEncoded.getEncodedLength()
  );

  // Write the property
  this.writeBuffer(stringEncoded);
};

ServerMessagePacket.prototype = Object.create(PacketWriter.prototype);
ServerMessagePacket.prototype.constructor = ServerMessagePacket;

const ItemAddPacket = function (position, thing, index) {
  /*
   * Class ItemAddPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ITEM_ADD, 10);

  this.writeClientId(thing.id);
  this.writeUInt8(thing.count);
  this.writePosition(position);
  this.writeUInt8(index);

  this.__debugStr = `id=${thing.id} pos=(${position.x},${position.y},${position.z}) idx=${index}`;
};

ItemAddPacket.prototype = Object.create(PacketWriter.prototype);
ItemAddPacket.prototype.constructor = ItemAddPacket;

const ItemRemovePacket = function (position, index, count) {
  /*
   * Class ItemRemovePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ITEM_REMOVE, 8);

  this.writePosition(position);
  this.writeUInt8(index);
  this.writeUInt8(count);

  this.__debugStr = `pos=(${position.x},${position.y},${position.z}) idx=${index}`;
};

ItemRemovePacket.prototype = Object.create(PacketWriter.prototype);
ItemRemovePacket.prototype.constructor = ItemRemovePacket;

const ContainerAddPacket = function (guid, index, item) {
  /*
   * Class ContainerAddPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CONTAINER_ADD, 8);

  this.writeUInt32(guid);
  this.writeUInt8(index);
  this.writeItem(item);

  this.__debugStr = `guid=${guid} idx=${index}`;
};

ContainerAddPacket.prototype = Object.create(PacketWriter.prototype);
ContainerAddPacket.prototype.constructor = ContainerAddPacket;

const ContainerRemovePacket = function (guid, index, count) {
  /*
   * Class containerRemovePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CONTAINER_REMOVE, 6);

  this.writeUInt32(guid);
  this.writeUInt8(index);
  this.writeUInt8(count);

  this.__debugStr = `guid=${guid} idx=${index}`;
};

ContainerRemovePacket.prototype = Object.create(PacketWriter.prototype);
ContainerRemovePacket.prototype.constructor = ContainerRemovePacket;

const ChunkPacket = function (chunk) {
  /*
   * Class ChunkPacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CHUNK, this.MAX_PACKET_SIZE);

  // This is the number that unique identifies the chunk
  this.writeUInt32(chunk.id);
  this.writePosition(chunk.position);

  this.__debugStr = `id=${chunk.id} pos=(${chunk.position.x},${chunk.position.y},${chunk.position.z})`;

  // Serialize each tile
  chunk.layers.forEach(function (layer) {
    // An empty layer
    if (layer === null) {
      return this.writeUInt8(0);
    }

    // Write the number of tiles
    this.writeUInt8(layer.length);

    layer.forEach(this.writeTile, this);
  }, this);
};

ChunkPacket.prototype = Object.create(PacketWriter.prototype);
ChunkPacket.prototype.constructor = ChunkPacket;

const CreatureStatePacket = function (creature) {
  /*
   * Class CreatureStatePacket
   * Wrapper for a packet that describes an outfit change
   */

  let name = creature.getProperty(CONST.PROPERTIES.NAME);
  let stringEncoded = this.encodeString(name);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CREATURE_STATE,
    stringEncoded.getEncodedLength() + 36
  );

  // The globally unique identifier
  this.writeUInt32(creature.getId());

  this.writeCreatureType(creature);
  this.writePosition(creature.getPosition());
  this.writeUInt8(creature.getProperty(CONST.PROPERTIES.DIRECTION));

  // Write the looktype
  this.writeOutfit(creature.getOutfit());

  // Write healthinformation
  this.writeUInt32(creature.getProperty(CONST.PROPERTIES.HEALTH));
  this.writeUInt32(creature.getProperty(CONST.PROPERTIES.HEALTH_MAX));
  // Use getSpeed() for players (dynamic calculation) or getProperty for monsters
  this.writeUInt16(creature.getSpeed ? creature.getSpeed() : creature.getProperty(CONST.PROPERTIES.SPEED));

  this.writeCreatureType(creature);
  this.writeBuffer(stringEncoded);

  // Condition size
  this.writeUInt8(0);

  // NPC flags (for NPC-type creatures)
  let npcFlags = 0;
  if (creature.constructor.name === "NPC") {
    if (creature.conversationHandler.tradeHandler.hasTrades()) npcFlags |= 1;
    if (creature.conversationHandler.conversation.bank === true) npcFlags |= 2;
    if (creature.conversationHandler.conversation.travel === true) npcFlags |= 4;
    if (creature.conversationHandler.conversation.keywords && (creature.conversationHandler.conversation.keywords.spell || creature.conversationHandler.conversation.keywords.spells)) npcFlags |= 8;
  }
  this.writeUInt8(npcFlags);

  this.__debugStr = `id=${creature.getId()} name="${creature.getProperty(CONST.PROPERTIES.NAME)}" pos=(${creature.getPosition().x},${creature.getPosition().y},${creature.getPosition().z})`;
};

CreatureStatePacket.prototype = Object.create(PacketWriter.prototype);
CreatureStatePacket.prototype.constructor = CreatureStatePacket;

const CancelMessagePacket = function (message) {
  /*
   * Class CancelMessagePacket
   * Wrapper for a packet that describes an outfit change
   */

  let stringEncoded = this.encodeString(message);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.MESSAGE_CANCEL,
    stringEncoded.getEncodedLength()
  );

  this.writeBuffer(stringEncoded);
};

CancelMessagePacket.prototype = Object.create(PacketWriter.prototype);
CancelMessagePacket.prototype.constructor = CancelMessagePacket;

const ToggleConditionPacket = function (toggle, cid, id, duration) {
  /*
   * Class CancelMessagePacket
   * Wrapper for a packet that describes an outfit change
   */

  // Inherits from packet writer
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TOGGLE_CONDITION, 9);

  this.writeUInt32(cid);
  this.writeBoolean(toggle);
  this.writeUInt16(id);
  this.writeUInt16(duration || 0);
};

ToggleConditionPacket.prototype = Object.create(PacketWriter.prototype);
ToggleConditionPacket.prototype.constructor = ToggleConditionPacket;

const ServerStatePacket = function (message) {
  /*
   * Class ServerStatePacket
   * Wrapper for a packet that contains the server state
   */

  let stringEncoded = this.encodeString(CONFIG.SERVER.VERSION);

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.STATE_SERVER,
    stringEncoded.getEncodedLength() + 13
  );

  // The chunk information and the world size size
  this.writeUInt16(gameServer.world.lattice.width);
  this.writeUInt16(gameServer.world.lattice.height);
  this.writeUInt8(gameServer.world.lattice.depth);

  this.writeUInt8(CONFIG.WORLD.CHUNK.WIDTH);
  this.writeUInt8(CONFIG.WORLD.CHUNK.HEIGHT);
  this.writeUInt8(CONFIG.WORLD.CHUNK.DEPTH);

  // Other information that is very impportant like the server tick rate
  this.writeUInt8(CONFIG.SERVER.MS_TICK_INTERVAL);
  this.writeUInt16(CONFIG.WORLD.CLOCK.SPEED);
  this.writeBuffer(stringEncoded);
  this.writeUInt16(CONFIG.SERVER.CLIENT_VERSION);
};

ServerStatePacket.prototype = Object.create(PacketWriter.prototype);
ServerStatePacket.prototype.constructor = ServerStatePacket;

const WorldTimePacket = function (timeOffset) {
  /*
   * Class WorldTimePacket
   * Wrapper for a packet that contains the current world time
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.WORLD_TIME, 4);

  this.writeUInt32(timeOffset);
};

WorldTimePacket.prototype = Object.create(PacketWriter.prototype);
WorldTimePacket.prototype.constructor = WorldTimePacket;

const CreatureForgetPacket = function (cid) {
  /*
   * Class CreatureForgetPacket
   * Wrapper for a packet to forget about a creature
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CREATURE_REMOVE, 4);

  this.writeUInt32(cid);
};

CreatureForgetPacket.prototype = Object.create(PacketWriter.prototype);
CreatureForgetPacket.prototype.constructor = CreatureForgetPacket;

const ContainerOpenPacket = function (cid, name, container) {
  /*
   * Class ContainerOpenPacket
   * Wrapper for a packet that opens a container with the specified id
   */

  let stringEncoded = this.encodeString(name);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CONTAINER_OPEN,
    stringEncoded.getEncodedLength() + 7 + container.getPacketSize()
  );

  // Get the items
  this.writeUInt32(container.guid);
  this.writeClientId(cid);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(container.size);

  container.getSlots().forEach(this.writeItem, this);
};

ContainerOpenPacket.prototype = Object.create(PacketWriter.prototype);
ContainerOpenPacket.prototype.constructor = ContainerOpenPacket;

const ContainerClosePacket = function (cid) {
  /*
   * Class ContainerClosePacket
   * Wrapper for a packet that closes a container with the specified id
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.CONTAINER_CLOSE, 4);

  // Get the items
  this.writeUInt32(cid);
};

ContainerClosePacket.prototype = Object.create(PacketWriter.prototype);
ContainerClosePacket.prototype.constructor = ContainerClosePacket;

const ChannelJoinPacket = function (channel) {
  /*
   * Class ChannelJoinPacket
   * Wrapper for a packet that joins a specific channel with a name
   */

  let stringEncoded = this.encodeString(channel.name);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CHANNEL_JOIN,
    4 + stringEncoded.getEncodedLength()
  );

  this.writeUInt32(channel.id);
  this.writeBuffer(stringEncoded);
};

ChannelJoinPacket.prototype = Object.create(PacketWriter.prototype);
ChannelJoinPacket.prototype.constructor = ChannelJoinPacket;

const ChannelWritePacket = function (cid, name, message, color) {
  /*
   * Class ChannelWritePacket
   * Packet to write a message from a creature to a specific channel
   */

  // Make sure to encode all strings
  let encodedName = this.encodeString(name);
  let encodedMessage = this.encodeString(message);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CREATURE_MESSAGE,
    5 + encodedName.getEncodedLength() + encodedMessage.getEncodedLength()
  );

  this.writeUInt32(cid);
  this.writeBuffer(encodedName);
  this.writeBuffer(encodedMessage);
  this.writeUInt8(color);
};

ChannelWritePacket.prototype = Object.create(PacketWriter.prototype);
ChannelWritePacket.prototype.constructor = ChannelWritePacket;

const TilePacket = function (position, id) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ITEM_TRANSFORM, 10);

  this.writePosition(position);
  this.writeClientId(id);
};

TilePacket.prototype = Object.create(PacketWriter.prototype);
TilePacket.prototype.constructor = TilePacket;

const ServerErrorPacket = function (message) {
  let stringEncoded = this.encodeString(message);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.SERVER_ERROR,
    stringEncoded.getEncodedLength()
  );

  this.writeBuffer(stringEncoded);
};

ServerErrorPacket.prototype = Object.create(PacketWriter.prototype);
ServerErrorPacket.prototype.constructor = ServerErrorPacket;

const DeathPacket = function () {
  /*
   * Class DeathPacket
   * Wrapper for the death packet (0x28)
   */

  // 0x28 = 40
  PacketWriter.call(this, 0x28, 0);
};

DeathPacket.prototype = Object.create(PacketWriter.prototype);
DeathPacket.prototype.constructor = DeathPacket;

const LatencyPacket = function () {
  /*
   * Class LatencyPacket
   * Simplest packet without payload to indicate latency request
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.LATENCY, 0);
};

LatencyPacket.prototype = Object.create(PacketWriter.prototype);
LatencyPacket.prototype.constructor = LatencyPacket;

const TargetPacket = function (cid) {
  /*
   * Class TargetPacket
   * Wrapper for a packet that selects a target
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TARGET, 4);

  this.writeUInt32(cid);
};

TargetPacket.prototype = Object.create(PacketWriter.prototype);
TargetPacket.prototype.constructor = TargetPacket;

const SpellAddPacket = function (sid) {
  /*
   * Class SpellAddPacket
   * Wrapper for a packet that describes adding an available spell to a player
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.SPELL_ADD, 2);

  this.writeUInt16(sid);
};

SpellAddPacket.prototype = Object.create(PacketWriter.prototype);
SpellAddPacket.prototype.constructor = SpellAddPacket;

const SpellCastPacket = function (sid, duration) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.SPELL_CAST, 6);

  this.writeUInt16(sid);
  this.writeUInt32(duration);
};

SpellCastPacket.prototype = Object.create(PacketWriter.prototype);
SpellCastPacket.prototype.constructor = SpellCastPacket;

const CreatureInformationPacket = function (creature) {
  /*
   * Class CreatureInformationPacket
   * Wrapper for creature information
   */

  let name = creature.getProperty(CONST.PROPERTIES.NAME);
  let stringEncoded = this.encodeString(name);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.CREATURE_INFORMATION,
    stringEncoded.getEncodedLength() + 4
  );

  this.writeBuffer(stringEncoded);

  // Add some information on the player
  if (creature.isPlayer()) {
    this.writeUInt16(
      creature.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE)
    );
    this.writeUInt8(creature.getProperty(CONST.PROPERTIES.SEX));
    this.writeUInt8(creature.getProperty(CONST.PROPERTIES.VOCATION));
  } else {
    this.writeUInt16(0);
    this.writeUInt8(0);
    this.writeUInt8(0);
  }
};

CreatureInformationPacket.prototype = Object.create(PacketWriter.prototype);
CreatureInformationPacket.prototype.constructor = CreatureInformationPacket;

const ItemInformationPacket = function (thing, includeDetails) {
  /*
   * Class ItemInformationPacket
   * Wrapper for thing information sent to the player
   */

  // Safely check if methods exist before calling them (Tiles don't have these methods)
  let isDistanceReadable = thing.isDistanceReadable ? thing.isDistanceReadable() : false;
  let distanceContent = isDistanceReadable && thing.getContent ? thing.getContent() : null;
  let articleText = thing.getArticle ? thing.getArticle() : "";
  let nameText = thing.getName ? thing.getName() : "unknown";
  let descriptionText = includeDetails && thing.getDescription ? thing.getDescription() : null;

  // Encode all the strings
  let distance = this.encodeString(distanceContent);
  let article = this.encodeString(articleText);
  let name = this.encodeString(nameText);
  let description = this.encodeString(descriptionText);

  // Determine combined length of all the strings
  let length =
    distance.getEncodedLength() +
    article.getEncodedLength() +
    name.getEncodedLength() +
    description.getEncodedLength();

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ITEM_INFORMATION, length + 9);

  // Server and client identifier
  this.writeUInt16(thing.id || 0);
  this.writeClientId(thing.id || 0);

  // Weight - check if methods exist
  let isPickupable = thing.isPickupable ? thing.isPickupable() : false;
  let weight = includeDetails && isPickupable && thing.getWeight ? thing.getWeight() : 0;
  this.writeUInt16(weight);

  // Attack and Armor - check if getAttribute exists
  let attack = includeDetails && thing.getAttribute ? thing.getAttribute("attack") : null;
  let armor = includeDetails && thing.getAttribute ? thing.getAttribute("armor") : null;
  this.writeUInt8(attack || 0);
  this.writeUInt8(armor || 0);

  // Write the encoded strings
  this.writeBuffer(distance);
  this.writeBuffer(article);
  this.writeBuffer(name);
  this.writeBuffer(description);

  // Always include the count too
  this.writeUInt8(thing.count || 0);
};

ItemInformationPacket.prototype = Object.create(PacketWriter.prototype);
ItemInformationPacket.prototype.constructor = ItemInformationPacket;

const ReadTextPacket = function (item) {
  let content = this.encodeString(item.getContent());
  let name = this.encodeString(item.getName());

  // Check if item is writeable (labels, letters, etc.)
  let isWriteable = item.isWriteable ? item.isWriteable() : false;

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.ITEM_TEXT,
    content.getEncodedLength() + name.getEncodedLength() + 5
  );

  this.writeUInt32(item.id); // Item ID for reference when saving
  this.writeBoolean(isWriteable);
  this.writeBuffer(content);
  this.writeBuffer(name);
};

ReadTextPacket.prototype = Object.create(PacketWriter.prototype);
ReadTextPacket.prototype.constructor = ReadTextPacket;

const CombatLockPacket = function (bool) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.COMBAT_LOCK, 1);

  this.writeBoolean(bool);
};

CombatLockPacket.prototype = Object.create(PacketWriter.prototype);
CombatLockPacket.prototype.constructor = CombatLockPacket;

const ChannelPrivatePacket = function (name, message) {
  /*
   * Class ChannelPrivatePacket
   * Wrapper for a private message to another player
   */

  let encodedName = this.encodeString(name);
  let encodedMessage = this.encodeString(message);

  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.MESSAGE_PRIVATE,
    encodedName.getEncodedLength() + encodedMessage.getEncodedLength()
  );

  // Write the sender name and the message
  this.writeBuffer(encodedName);
  this.writeBuffer(encodedMessage);
};

ChannelPrivatePacket.prototype = Object.create(PacketWriter.prototype);
ChannelPrivatePacket.prototype.constructor = ChannelPrivatePacket;

const NPCTradePacket = function (cid, offers, gold, owned) {
  /*
   * Class NPCTradePacket
   * Wrapper for NPC trade offers
   */

  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_OFFER, this.MAX_PACKET_SIZE);

  this.writeUInt32(cid);
  this.writeUInt32(gold || 0);
  this.writeUInt8(offers.length);

  // Write individual trade information
  offers.forEach(function (offer) {
    // Encode the name of the item
    let stringEncoded = this.encodeString(offer.name);
    let proto = process.gameServer.database.getThingPrototype(offer.id);
    let weight = proto ? (proto.properties.weight || 0) : 0;

    this.writeClientId(offer.id);
    this.writeBuffer(stringEncoded);
    this.writeUInt32(offer.price);
    this.writeUInt32(weight);
    // Convert type string to boolean: "sell" = true, "buy" = false
    this.writeBoolean(offer.type === "sell");
    this.writeUInt8(offer.count || 0);
  }, this);

  // Write ownership data (how many of each offer the player actually has)
  if (owned && owned.length > 0) {
    this.writeUInt8(owned.length);
    owned.forEach(function (count) {
      this.writeUInt8(count);
    }, this);
  } else {
    this.writeUInt8(0);
  }
};

NPCTradePacket.prototype = Object.create(PacketWriter.prototype);
NPCTradePacket.prototype.constructor = NPCTradePacket;

const OracleShowPacket = function (npcId, vocations, towns) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ORACLE_SHOW, this.MAX_PACKET_SIZE);
  this.writeUInt32(npcId);
  this.writeUInt8(vocations.length);
  vocations.forEach(function(v) {
    this.writeUInt8(v.id);
    this.writeUInt8(v.outfitId);
    this.writeBuffer(this.encodeString(v.name));
  }, this);
  this.writeUInt8(towns.length);
  towns.forEach(function(t) {
    this.writeUInt8(t.id);
    this.writeBuffer(this.encodeString(t.name));
  }, this);
};
OracleShowPacket.prototype = Object.create(PacketWriter.prototype);
OracleShowPacket.prototype.constructor = OracleShowPacket;

const BanPanelPacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.BAN_PANEL, 0);
};
BanPanelPacket.prototype = Object.create(PacketWriter.prototype);
BanPanelPacket.prototype.constructor = BanPanelPacket;

const BotPanelPacket = function (suspects, cheaters) {
  let data = JSON.stringify({ suspects: suspects, cheaters: cheaters });
  let stringEncoded = new TextEncoder("utf-8").encode(data);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.BOT_PANEL, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
BotPanelPacket.prototype = Object.create(PacketWriter.prototype);
BotPanelPacket.prototype.constructor = BotPanelPacket;

const AdminAddSkillModalPacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.ADMIN_ADD_SKILL_MODAL, 0);
};
AdminAddSkillModalPacket.prototype = Object.create(PacketWriter.prototype);
AdminAddSkillModalPacket.prototype.constructor = AdminAddSkillModalPacket;

const IgnoreDataPacket = function (ignoredList) {
  let count = ignoredList.length;
  let totalLength = 2;
  let encoded = ignoredList.map(function (name) {
    let e = new TextEncoder("utf-8").encode(name);
    totalLength += 2 + e.length;
    return e;
  });
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.IGNORE_DATA, totalLength);
  this.writeUInt16(count);
  encoded.forEach(function (e) {
    this.writeUInt16(e.length);
    this.writeBuffer(e);
  }, this);
};
IgnoreDataPacket.prototype = Object.create(PacketWriter.prototype);
IgnoreDataPacket.prototype.constructor = IgnoreDataPacket;

const IgnoreAddResultPacket = function (name, success) {
  let stringEncoded = new TextEncoder("utf-8").encode(name);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.IGNORE_ADD_RESULT, stringEncoded.length + 3);
  this.writeUInt16(stringEncoded.length);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(success ? 1 : 0);
};
IgnoreAddResultPacket.prototype = Object.create(PacketWriter.prototype);
IgnoreAddResultPacket.prototype.constructor = IgnoreAddResultPacket;

const IgnoreRemoveResultPacket = function (name, success) {
  let stringEncoded = new TextEncoder("utf-8").encode(name);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.IGNORE_REMOVE_RESULT, stringEncoded.length + 3);
  this.writeUInt16(stringEncoded.length);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(success ? 1 : 0);
};
IgnoreRemoveResultPacket.prototype = Object.create(PacketWriter.prototype);
IgnoreRemoveResultPacket.prototype.constructor = IgnoreRemoveResultPacket;

const PlayerStatePacket = function (player) {
  /*
   * Class PlayerStatePacket
   * Wrapper for a packet that describes an outfit change
   */

  let stringEncoded = this.encodeString(
    player.getProperty(CONST.PROPERTIES.NAME)
  );

  // Inherits from packet writer
  PacketWriter.call(
    this,
    CONST.PROTOCOL.SERVER.STATE_PLAYER,
    this.MAX_PACKET_SIZE
  );

  // Get the current values from player properties with debug logs
  let health = player.getProperty(CONST.PROPERTIES.HEALTH);
  let healthMax = player.getProperty(CONST.PROPERTIES.HEALTH_MAX);
  let mana = player.getProperty(CONST.PROPERTIES.MANA);
  let manaMax = player.getProperty(CONST.PROPERTIES.MANA_MAX);
  let capacity = player.getProperty(CONST.PROPERTIES.CAPACITY);
  let capacityMax = player.getProperty(CONST.PROPERTIES.CAPACITY_MAX);


  // Basic player data
  this.writeUInt32(player.getId());
  this.writeBuffer(stringEncoded);
  this.writePosition(player.getPosition());
  this.writeUInt8(player.getProperty(CONST.PROPERTIES.DIRECTION));

  // Write the skills
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.MAGIC));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.FIST));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.CLUB));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.SWORD));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.AXE));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.DISTANCE));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.SHIELDING));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.FISHING));
  this.writeUInt32(player.skills.getSkillValue(CONST.PROPERTIES.EXPERIENCE));
  // Write level (calculated from experience)
  this.writeUInt16(player.skills.getSkillLevel(CONST.PROPERTIES.EXPERIENCE) || 1);


  // State variables - use getSpeed() for dynamic calculation based on level
  this.writeUInt16(player.getSpeed());
  this.writeUInt8(player.getProperty(CONST.PROPERTIES.ATTACK));
  this.writeUInt8(player.getProperty(CONST.PROPERTIES.ATTACK_SPEED));
  // Add vocation so client can use correct skill formulas
  let voc = player.getProperty(CONST.PROPERTIES.VOCATION);
  this.writeUInt8(voc);

  this.writeEquipment(player.containerManager.equipment);

  // Write the number of available outfits
  this.writeOutfits(player);

  // Write the available spells
  this.writeUInt8(0);
  this.writeUInt8(0);

  // Write the outfit
  this.writeOutfit(player.getProperty(CONST.PROPERTIES.OUTFIT));

  // Write health and mana information
  this.writeUInt32(health);
  this.writeUInt32(healthMax);
  this.writeUInt32(mana);
  this.writeUInt32(manaMax);
  this.writeUInt32(capacity);
  this.writeUInt32(capacityMax);

  // Conditions
  this.writeUInt8(0);

  // Blessings (bitmask: bit 0 = blessing 1, etc.) + premium flag
  this.writeUInt8(player.getBlessingBitmask());
  this.writeUInt8(player.isPremium() ? 1 : 0);

};

PlayerStatePacket.prototype = Object.create(PacketWriter.prototype);
PlayerStatePacket.prototype.constructor = PlayerStatePacket;

const FoodTimerPacket = function (remainingSeconds) {
  /*
   * Class FoodTimerPacket
   * Wrapper for a packet that sends the remaining food timer to the client
   */

  // Inherits from packet writer
  PacketWriter.call(this, 51, 4); // 51 = FOOD_TIMER

  this.writeUInt32(remainingSeconds);
};

FoodTimerPacket.prototype = Object.create(PacketWriter.prototype);
FoodTimerPacket.prototype.constructor = FoodTimerPacket;

const TrainTimerPacket = function (slotIndex, remainingSeconds) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRAINING_TIMER, 5);
  this.writeUInt8(slotIndex);
  this.writeUInt32(remainingSeconds);
};

TrainTimerPacket.prototype = Object.create(PacketWriter.prototype);
TrainTimerPacket.prototype.constructor = TrainTimerPacket;

const QuestLogPacket = function (quests) {
  /*
   * Class QuestLogPacket
   * Packet to send the list of quests
   */

  // Use MAX_PACKET_SIZE since we need to encode strings dynamically
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.QUEST_LOG, this.MAX_PACKET_SIZE);

  this.writeUInt16(quests.length);

  quests.forEach(quest => {
    this.writeUInt16(quest.id);
    let encodedName = this.encodeString(quest.name);
    this.writeBuffer(encodedName);
    this.writeBoolean(quest.completed);
  }, this);
};
QuestLogPacket.prototype = Object.create(PacketWriter.prototype);
QuestLogPacket.prototype.constructor = QuestLogPacket;

const QuestLinePacket = function (questId, missions) {
  /*
   * Class QuestLinePacket
   * Packet to send missions of a specific quest
   */

  // Use MAX_PACKET_SIZE since we need to encode strings dynamically
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.QUEST_LINE, this.MAX_PACKET_SIZE);

  this.writeUInt16(questId);
  this.writeUInt8(missions.length);

  missions.forEach(mission => {
    let encodedName = this.encodeString(mission.name);
    this.writeBuffer(encodedName);
    let encodedDescription = this.encodeString(mission.description);
    this.writeBuffer(encodedDescription);
    this.writeBoolean(mission.completed || false);
  }, this);
};
QuestLinePacket.prototype = Object.create(PacketWriter.prototype);
QuestLinePacket.prototype.constructor = QuestLinePacket;

const PartyInvitePacket = function (inviterName) {
  let stringEncoded = this.encodeString(inviterName);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_INVITE, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
PartyInvitePacket.prototype = Object.create(PacketWriter.prototype);
PartyInvitePacket.prototype.constructor = PartyInvitePacket;

const PartyLeavePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_LEAVE, 0);
};
PartyLeavePacket.prototype = Object.create(PacketWriter.prototype);
PartyLeavePacket.prototype.constructor = PartyLeavePacket;

const PartySkullPacket = function (creatureId, skullType) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_SKULL, 5);
  this.writeUInt32(creatureId);
  this.writeUInt8(skullType);
};
PartySkullPacket.prototype = Object.create(PacketWriter.prototype);
PartySkullPacket.prototype.constructor = PartySkullPacket;

const PartyShieldPacket = function (creatureId, shieldType) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_SHIELD, 5);
  this.writeUInt32(creatureId);
  this.writeUInt8(shieldType);
};
PartyShieldPacket.prototype = Object.create(PacketWriter.prototype);
PartyShieldPacket.prototype.constructor = PartyShieldPacket;

const PartyUpdatePacket = function (party) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_DATA, this.MAX_PACKET_SIZE);
  this.writeUInt8(party.members.length);
  this.writeUInt32(party.leader.getId());
  party.members.forEach(function (member) {
    let nameEncoded = this.encodeString(member.getProperty(CONST.PROPERTIES.NAME));
    this.writeUInt32(member.getId());
    this.writeBuffer(nameEncoded);
    this.writeUInt8(Math.floor(member.getProperty(CONST.PROPERTIES.HEALTH) * 100 / Math.max(1, member.getProperty(CONST.PROPERTIES.HEALTH_MAX))));
    this.writeUInt8(member.getProperty(CONST.PROPERTIES.VOCATION));
    this.writeUInt16(member.getLevel());
    this.writeOutfit(member.getProperty(CONST.PROPERTIES.OUTFIT));
  }, this);
};
PartyUpdatePacket.prototype = Object.create(PacketWriter.prototype);
PartyUpdatePacket.prototype.constructor = PartyUpdatePacket;

const PartyDataPacket = function (party) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_DATA, this.MAX_PACKET_SIZE);
  this.writeUInt8(party.members.length);
  this.writeUInt32(party.leader.getId());
  party.members.forEach(function (member) {
    let nameEncoded = this.encodeString(member.getProperty(CONST.PROPERTIES.NAME));
    this.writeUInt32(member.getId());
    this.writeBuffer(nameEncoded);
    this.writeUInt8(Math.floor(member.getProperty(CONST.PROPERTIES.HEALTH) * 100 / Math.max(1, member.getProperty(CONST.PROPERTIES.HEALTH_MAX))));
    this.writeUInt8(member.getProperty(CONST.PROPERTIES.VOCATION));
    this.writeUInt16(member.getLevel());
    this.writeOutfit(member.getProperty(CONST.PROPERTIES.OUTFIT));
  }, this);
};
PartyDataPacket.prototype = Object.create(PacketWriter.prototype);
PartyDataPacket.prototype.constructor = PartyDataPacket;

const PartyJoinPacket = function (party) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PARTY_DATA, this.MAX_PACKET_SIZE);
  this.writeUInt8(party.members.length);
  this.writeUInt32(party.leader.getId());
  party.members.forEach(function (member) {
    let nameEncoded = this.encodeString(member.getProperty(CONST.PROPERTIES.NAME));
    this.writeUInt32(member.getId());
    this.writeBuffer(nameEncoded);
    this.writeUInt8(Math.floor(member.getProperty(CONST.PROPERTIES.HEALTH) * 100 / Math.max(1, member.getProperty(CONST.PROPERTIES.HEALTH_MAX))));
    this.writeUInt8(member.getProperty(CONST.PROPERTIES.VOCATION));
    this.writeUInt16(member.getLevel());
    this.writeOutfit(member.getProperty(CONST.PROPERTIES.OUTFIT));
  }, this);
};
PartyJoinPacket.prototype = Object.create(PacketWriter.prototype);
PartyJoinPacket.prototype.constructor = PartyJoinPacket;

const VipAddResultPacket = function (name, success, online) {
  let stringEncoded = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.VIP_ADD_RESULT, stringEncoded.getEncodedLength() + 2);
  this.writeBuffer(stringEncoded);
  this.writeBoolean(success);
  this.writeBoolean(online || false);
};
VipAddResultPacket.prototype = Object.create(PacketWriter.prototype);
VipAddResultPacket.prototype.constructor = VipAddResultPacket;

const BlessingUpdatePacket = function (bitmask, isPremium) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.BLESSING_UPDATE, 2);
  this.writeUInt8(bitmask);
  this.writeUInt8(isPremium ? 1 : 0);
};
BlessingUpdatePacket.prototype = Object.create(PacketWriter.prototype);
BlessingUpdatePacket.prototype.constructor = BlessingUpdatePacket;

const GuildDataPacket = function (guildData) {
  let json = JSON.stringify(guildData === null ? { error: "You are not in a guild." } : guildData);
  let stringEncoded = new TextEncoder("utf-8").encode(json);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.GUILD_DATA, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
GuildDataPacket.prototype = Object.create(PacketWriter.prototype);
GuildDataPacket.prototype.constructor = GuildDataPacket;

const GuildInviteResponsePacket = function (success, message) {
  let stringEncoded = new TextEncoder("utf-8").encode(message);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.GUILD_INVITE_RESULT, 1 + stringEncoded.getEncodedLength());
  this.writeUInt8(success ? 1 : 0);
  this.writeBuffer(stringEncoded);
};
GuildInviteResponsePacket.prototype = Object.create(PacketWriter.prototype);
GuildInviteResponsePacket.prototype.constructor = GuildInviteResponsePacket;

const HouseInfoPacket = function (houseId, sqm, price, name, guildhall, canBuy, reason, pricePerSqm, rentPeriodDays, buyPrice, beds) {
  let data = JSON.stringify({
    houseId: houseId,
    sqm: sqm,
    price: price,
    name: name,
    guildhall: guildhall,
    canBuy: canBuy,
    reason: reason || "",
    pricePerSqm: pricePerSqm,
    rentPeriodDays: rentPeriodDays,
    buyPrice: buyPrice,
    beds: beds || 0
  });
  let stringEncoded = new TextEncoder("utf-8").encode(data);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.HOUSE_INFO, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
HouseInfoPacket.prototype = Object.create(PacketWriter.prototype);
HouseInfoPacket.prototype.constructor = HouseInfoPacket;

const HouseBuyPacket = function (reader) {
  this.houseId = reader.readUInt32();
};

const HouseBuyOutrightPacket = function (reader) {
  this.houseId = reader.readUInt32();
};

const HouseManageInfoPacket = function (jsonString) {
  let stringEncoded = new TextEncoder("utf-8").encode(jsonString);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.HOUSE_MANAGE_INFO, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
HouseManageInfoPacket.prototype = Object.create(PacketWriter.prototype);
HouseManageInfoPacket.prototype.constructor = HouseManageInfoPacket;

const RentConfirmInfoPacket = function (data) {
  let stringEncoded = new TextEncoder("utf-8").encode(JSON.stringify(data));
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.RENT_CONFIRM_INFO, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
RentConfirmInfoPacket.prototype = Object.create(PacketWriter.prototype);
RentConfirmInfoPacket.prototype.constructor = RentConfirmInfoPacket;

const HouseInvitePacketReader = function (packet) {
  this.name = packet.readString();
};
const HouseRemoveGuestPacketReader = function (packet) {
  this.name = packet.readString();
};
const HouseSellPacketReader = function (packet) {
  this.buyerName = packet.readString();
};
const HouseSetRentPacketReader = function (packet) {
  this.price = packet.readUInt32();
};
const HouseSetListingPacketReader = function (packet) {
  this.price = packet.readUInt32();
};

const HouseConfirmRentPacketReader = function (packet) {
  this.price = packet.readUInt32();
};



const TradeRequestPacket = function (requesterName) {
  let stringEncoded = new TextEncoder("utf-8").encode(requesterName);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_REQUEST, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
TradeRequestPacket.prototype = Object.create(PacketWriter.prototype);
TradeRequestPacket.prototype.constructor = TradeRequestPacket;

const TradeStartPacket = function (playerName, opponentName) {
  let data = JSON.stringify({ playerName: playerName, opponentName: opponentName });
  let stringEncoded = new TextEncoder("utf-8").encode(data);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_START, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
TradeStartPacket.prototype = Object.create(PacketWriter.prototype);
TradeStartPacket.prototype.constructor = TradeStartPacket;

const TradeUpdatePacket = function (opponentItems, opponentGold, ownItems, ownGold) {
  let data = JSON.stringify({
    opponentItems: opponentItems,
    opponentGold: opponentGold,
    ownItems: ownItems,
    ownGold: ownGold
  });
  let stringEncoded = new TextEncoder("utf-8").encode(data);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_UPDATE, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
TradeUpdatePacket.prototype = Object.create(PacketWriter.prototype);
TradeUpdatePacket.prototype.constructor = TradeUpdatePacket;

const TradeConfirmPacket = function (confirmedA, confirmedB) {
  let data = JSON.stringify({ confirmedA: confirmedA, confirmedB: confirmedB });
  let stringEncoded = new TextEncoder("utf-8").encode(data);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_CONFIRM, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
TradeConfirmPacket.prototype = Object.create(PacketWriter.prototype);
TradeConfirmPacket.prototype.constructor = TradeConfirmPacket;

const TradeCompletePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_COMPLETE, 1);
  this.writeUInt8(1);
};
TradeCompletePacket.prototype = Object.create(PacketWriter.prototype);
TradeCompletePacket.prototype.constructor = TradeCompletePacket;

const TradeCancelPacket = function (reason) {
  let stringEncoded = new TextEncoder("utf-8").encode(reason);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.TRADE_CANCEL, stringEncoded.getEncodedLength());
  this.writeBuffer(stringEncoded);
};
TradeCancelPacket.prototype = Object.create(PacketWriter.prototype);
TradeCancelPacket.prototype.constructor = TradeCancelPacket;

const TradeRequestPacketClient = function (reader) {
  this.targetId = reader.readUInt32();
};
const TradeAddItemPacket = function (reader) {
  this.containerId = reader.readUInt8();
  this.slotIndex = reader.readUInt8();
  this.count = reader.readUInt8();
};
const TradeRemoveItemPacket = function (reader) {
  this.slotIndex = reader.readUInt8();
};
const TradeSetGoldPacket = function (reader) {
  this.amount = reader.readUInt32();
};
const VoiceDataPacketClient = function (reader) {
  let length = reader.readUInt16();
  this.audioData = reader.readBuffer(length);
};

const VoiceDataPacket = function (senderName, audioData) {
  let nameEncoded = new TextEncoder("utf-8").encode(senderName);
  let totalLength = 2 + nameEncoded.length + 2 + audioData.length;
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.VOICE_DATA, totalLength);
  this.writeUInt16(nameEncoded.length);
  this.writeBuffer(nameEncoded);
  this.writeUInt16(audioData.length);
  this.writeBuffer(audioData);
};
VoiceDataPacket.prototype = Object.create(PacketWriter.prototype);
VoiceDataPacket.prototype.constructor = VoiceDataPacket;

const PremiumBalanceUpdatePacket = function (balance) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.PREMIUM_BALANCE_UPDATE, 4);
  this.writeUInt32(balance);
};
PremiumBalanceUpdatePacket.prototype = Object.create(PacketWriter.prototype);
PremiumBalanceUpdatePacket.prototype.constructor = PremiumBalanceUpdatePacket;

const OutfitUnlockPacket = function (outfitId, outfitName) {
  let nameEncoded = this.encodeString(outfitName);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.OUTFIT_UNLOCK, 2 + nameEncoded.getEncodedLength() + 1);
  this.writeUInt16(outfitId);
  this.writeBuffer(nameEncoded);
  this.writeUInt8(0);
};
OutfitUnlockPacket.prototype = Object.create(PacketWriter.prototype);
OutfitUnlockPacket.prototype.constructor = OutfitUnlockPacket;

const GlobalBoostUpdatePacket = function (expExpiry, lootExpiry, skillsExpiry) {
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.GLOBAL_BOOST_UPDATE, 14);
  this.writeUInt32(expExpiry);
  this.writeUInt32(lootExpiry);
  this.writeUInt32(skillsExpiry || 0);
};
GlobalBoostUpdatePacket.prototype = Object.create(PacketWriter.prototype);
GlobalBoostUpdatePacket.prototype.constructor = GlobalBoostUpdatePacket;

const MarketOpenOwnerPacket = function (shopName, items, gold, retroGold) {
  let nameEncoded = this.encodeString(shopName || "");
  let totalLength = nameEncoded.getEncodedLength() + 12;
  let itemsData = [];
  items.forEach(function (item) {
    let enc = this.encodeString(item.name || "");
    itemsData.push({ enc: enc, item: item });
    totalLength += enc.getEncodedLength() + 13;
  }, this);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.MARKET_OPEN_OWNER, totalLength);
  this.writeBuffer(nameEncoded);
  this.writeUInt32(gold);
  this.writeUInt32(retroGold);
  this.writeUInt8(items.length);
  itemsData.forEach(function (data) {
    this.writeUInt16(data.item.id);
    this.writeBuffer(data.enc);
    this.writeUInt32(data.item.priceGold || 0);
    this.writeUInt32(data.item.priceRetro || 0);
    this.writeUInt8(data.item.count || 1);
  }, this);
};
MarketOpenOwnerPacket.prototype = Object.create(PacketWriter.prototype);
MarketOpenOwnerPacket.prototype.constructor = MarketOpenOwnerPacket;

const MarketOpenBuyerPacket = function (sellerName, shopName, items) {
  let sellerEncoded = this.encodeString(sellerName || "");
  let shopEncoded = this.encodeString(shopName || "");
  let totalLength = sellerEncoded.getEncodedLength() + shopEncoded.getEncodedLength() + 5;
  let itemsData = [];
  items.forEach(function (item) {
    let enc = this.encodeString(item.name || "");
    itemsData.push({ enc: enc, item: item });
    totalLength += enc.getEncodedLength() + 13;
  }, this);
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.MARKET_OPEN_BUYER, totalLength);
  this.writeBuffer(sellerEncoded);
  this.writeBuffer(shopEncoded);
  this.writeUInt8(items.length);
  itemsData.forEach(function (data) {
    this.writeUInt16(data.item.id);
    this.writeBuffer(data.enc);
    this.writeUInt32(data.item.priceGold || 0);
    this.writeUInt32(data.item.priceRetro || 0);
    this.writeUInt8(data.item.count || 1);
  }, this);
};
MarketOpenBuyerPacket.prototype = Object.create(PacketWriter.prototype);
MarketOpenBuyerPacket.prototype.constructor = MarketOpenBuyerPacket;

const MarketBuyResultPacket = function (success, message) {
  let msgEncoded = this.encodeString(message || "");
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.MARKET_BUY_RESULT, msgEncoded.getEncodedLength() + 1);
  this.writeBoolean(success);
  this.writeBuffer(msgEncoded);
};
MarketBuyResultPacket.prototype = Object.create(PacketWriter.prototype);
MarketBuyResultPacket.prototype.constructor = MarketBuyResultPacket;

const MarketClosedPacket = function (message) {
  let msgEncoded = this.encodeString(message || "");
  PacketWriter.call(this, CONST.PROTOCOL.SERVER.MARKET_CLOSED, msgEncoded.getEncodedLength());
  this.writeBuffer(msgEncoded);
};
MarketClosedPacket.prototype = Object.create(PacketWriter.prototype);
MarketClosedPacket.prototype.constructor = MarketClosedPacket;

module.exports = {
  CancelMessagePacket,
  ChannelDefaultPacket,
  ChannelJoinPacket,
  ChannelWritePacket,
  ChannelPrivatePacket,
  ChunkPacket,
  CombatLockPacket,
  ContainerClosePacket,
  ContainerOpenPacket,
  ContainerAddPacket,
  ContainerRemovePacket,
  CreatureForgetPacket,
  CreatureInformationPacket,
  CreatureMovePacket,
  CreatureStatePacket,
  CreatureTeleportPacket,
  CreatureTeleportPacket,
  DeathPacket,
  EffectDistancePacket,
  EffectMagicPacket,
  EmotePacket,
  ItemAddPacket,
  ItemInformationPacket,
  ItemRemovePacket,
  LatencyPacket,
  NPCTradePacket,
  OracleShowPacket,
  OutfitPacket,
  PlayerLoginPacket,
  PlayerLogoutPacket,
  PlayerStatePacket,
  CreaturePropertyPacket,
  ReadTextPacket,
  ServerErrorPacket,
  ServerStatePacket,
  ServerMessagePacket,
  SpellAddPacket,
  SpellCastPacket,
  StringCreaturePropertyPacket,
  TargetPacket,
  TilePacket,
  ToggleConditionPacket,
  WorldTimePacket,
  FoodTimerPacket,
  TrainTimerPacket,
  QuestLogPacket,
  QuestLinePacket,
  PartyInvitePacket,
  PartyLeavePacket,
  PartyShieldPacket,
  PartySkullPacket,
  PartyUpdatePacket,
  PartyDataPacket,
  PartyJoinPacket,
  VipAddResultPacket,
  BlessingUpdatePacket,
  GuildDataPacket,
  GuildInviteResponsePacket,
  HouseInfoPacket,
  HouseBuyPacket,
  HouseBuyOutrightPacket,
  HouseManageInfoPacket,
  RentConfirmInfoPacket,
  HouseInvitePacketReader,
  HouseRemoveGuestPacketReader,
  HouseSellPacketReader,
  HouseSetRentPacketReader,
  HouseSetListingPacketReader,
  HouseConfirmRentPacketReader,
  TradeRequestPacket,
  TradeStartPacket,
  TradeUpdatePacket,
  TradeConfirmPacket,
  TradeCompletePacket,
  TradeCancelPacket,
  TradeRequestPacketClient,
  TradeAddItemPacket,
  TradeRemoveItemPacket,
  TradeSetGoldPacket,
  BanPanelPacket,
  AdminAddSkillModalPacket,
  IgnoreDataPacket,
  IgnoreAddResultPacket,
  IgnoreRemoveResultPacket,
  VoiceDataPacketClient,
  VoiceDataPacket,
  PremiumBalanceUpdatePacket,
  GlobalBoostUpdatePacket,
  BotPanelPacket,
  MarketOpenOwnerPacket,
  MarketOpenBuyerPacket,
  MarketBuyResultPacket,
  MarketClosedPacket,
  OutfitUnlockPacket
};
