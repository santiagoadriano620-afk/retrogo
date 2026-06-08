const OutfitChangePacket = function (outfit) {

  /*
   * Class OutfitChangePacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.OUTFIT, 8);

  // Identifier
  this.writeUInt16(outfit.id);

  // Details
  this.writeUInt8(outfit.details.head);
  this.writeUInt8(outfit.details.body);
  this.writeUInt8(outfit.details.legs);
  this.writeUInt8(outfit.details.feet);

  this.writeBoolean(outfit.addonOne);
  this.writeBoolean(outfit.addonTwo);

}

OutfitChangePacket.prototype = Object.create(PacketWriter.prototype);
OutfitChangePacket.prototype.constructor = OutfitChangePacket;

const ContainerClosePacket = function (cid) {

  /*
   * Class OutfitChangePacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CONTAINER_CLOSE, 4);

  // Identifier
  this.writeUInt32(cid);

}

ContainerClosePacket.prototype = Object.create(PacketWriter.prototype);
ContainerClosePacket.prototype.constructor = ContainerClosePacket;

const OpenGiftContainerPacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.OPEN_GIFT_CONTAINER, 1);
}

OpenGiftContainerPacket.prototype = Object.create(PacketWriter.prototype);
OpenGiftContainerPacket.prototype.constructor = OpenGiftContainerPacket;

const RequestPremiumBalancePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.REQUEST_PREMIUM_BALANCE, 1);
};
RequestPremiumBalancePacket.prototype = Object.create(PacketWriter.prototype);
RequestPremiumBalancePacket.prototype.constructor = RequestPremiumBalancePacket;

const BuyPremiumItemPacket = function (itemId, quantity) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.BUY_PREMIUM_ITEM, 4);
  this.writeUInt16(itemId);
  this.writeUInt8(quantity);
};
BuyPremiumItemPacket.prototype = Object.create(PacketWriter.prototype);
BuyPremiumItemPacket.prototype.constructor = BuyPremiumItemPacket;

const ChannelMessagePacket = function (id, loudness, string) {

  /*
   * Class ChannelMessagePacket
   * Wrapper for a channel message packet
   */

  let { stringEncoded, stringLength } = this.encodeString(string);

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CHANNEL_MESSAGE, stringLength + 3);

  this.writeUInt8(id);
  this.writeUInt8(loudness);
  this.writeBuffer(stringEncoded);

}

ChannelMessagePacket.prototype = Object.create(PacketWriter.prototype);
ChannelMessagePacket.prototype.constructor = ChannelMessagePacket;

const ChannelJoinPacket = function (id) {

  /*
   * Class OutfitChangePacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CHANNEL_JOIN, 1);

  this.writeUInt8(id);

}

ChannelJoinPacket.prototype = Object.create(PacketWriter.prototype);
ChannelJoinPacket.prototype.constructor = ChannelJoinPacket;

const ChannelLeavePacket = function (id) {

  /*
   * Class OutfitChangePacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CHANNEL_LEAVE, 1);

  this.writeUInt8(id);

}

ChannelLeavePacket.prototype = Object.create(PacketWriter.prototype);
ChannelLeavePacket.prototype.constructor = ChannelLeavePacket;

const ChannelPrivatePacket = function (name, message) {

  /*
   * Class ChannelPrivatePacket
   * WRapper for an outfit change packet
   */

  let encodedName = this.encodeString(name);
  let encodedMessage = this.encodeString(message);

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CHANNEL_PRIVATE_MESSAGE, encodedName.stringLength + encodedMessage.stringLength);

  this.writeBuffer(encodedName.stringEncoded);
  this.writeBuffer(encodedMessage.stringEncoded);

}

ChannelPrivatePacket.prototype = Object.create(PacketWriter.prototype);
ChannelPrivatePacket.prototype.constructor = ChannelPrivatePacket;

const MovementPacket = function (direction) {

  /*
   * Class OutfitChangePacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.MOVE, 1);

  this.writeUInt8(direction);

}

MovementPacket.prototype = Object.create(PacketWriter.prototype);
MovementPacket.prototype.constructor = MovementPacket;

const PlayerTurnPacket = function (direction) {

  /*
   * Class PlayerTurnPacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TURN, 1);

  this.writeUInt8(direction);

}

PlayerTurnPacket.prototype = Object.create(PacketWriter.prototype);
PlayerTurnPacket.prototype.constructor = PlayerTurnPacket;

const ItemMovePacket = function (fromThing, toThing, count) {

  /*
   * Class PlayerTurnPacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.THING_MOVE, 17);

  this.__writeGenericMove(fromThing);
  this.__writeGenericMove(toThing);
  this.writeUInt8(count);

}

ItemMovePacket.prototype = Object.create(PacketWriter.prototype);
ItemMovePacket.prototype.constructor = ItemMovePacket;

const ItemLookPacket = function (thing) {

  /*
   * Class ItemLookPacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.THING_LOOK, 8);

  this.__writeGenericMove(thing);

}

ItemLookPacket.prototype = Object.create(PacketWriter.prototype);
ItemLookPacket.prototype.constructor = ItemLookPacket;

const ItemUsePacket = function (thing) {

  /*
   * Class ItemLookPacket
   * WRapper for an outfit change packet
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.THING_USE, 8);

  this.__writeGenericMove(thing);

}

ItemUsePacket.prototype = Object.create(PacketWriter.prototype);
ItemUsePacket.prototype.constructor = ItemUsePacket;

const ItemUseWithPacket = function (fromThing, toThing) {

  /*
   * Class ItemUseWithPacket
   * Wrapper packet for an use with action
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.THING_USE_WITH, 16);

  this.__writeGenericMove(fromThing);
  this.__writeGenericMove(toThing);

}

ItemUseWithPacket.prototype = Object.create(PacketWriter.prototype);
ItemUseWithPacket.prototype.constructor = ItemUseWithPacket;

const ItemUseOnCreaturePacket = function (fromThing, creatureId) {

  /*
   * Class ItemUseOnCreaturePacket
   * Wrapper packet for using an item (like a rune) on a creature from battle list
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.THING_USE_ON_CREATURE, 12);

  // Write the source item location
  this.__writeGenericMove(fromThing);

  // Write the target creature ID
  this.writeUInt32(creatureId);

}

ItemUseOnCreaturePacket.prototype = Object.create(PacketWriter.prototype);
ItemUseOnCreaturePacket.prototype.constructor = ItemUseOnCreaturePacket;

const TargetPacket = function (id) {

  /*
   * Class ItemUseWithPacket
   * Wrapper packet for an use with action
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TARGET, 4);

  this.writeUInt32(id);

}

TargetPacket.prototype = Object.create(PacketWriter.prototype);
TargetPacket.prototype.constructor = TargetPacket;

const LogoutPacket = function () {

  /*
   * Class LogoutPacket
   * Wrapper for logout request for the player
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.LOGOUT, 0);

}

LogoutPacket.prototype = Object.create(PacketWriter.prototype);
LogoutPacket.prototype.constructor = LogoutPacket;

const FriendRemovePacket = function (string) {

  /*
   * Class LogoutPacket
   * Wrapper for logout request for the player
   */

  let { stringEncoded, stringLength } = this.encodeString(string);

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.FRIEND_REMOVE, stringLength);

  this.writeBuffer(stringEncoded);

}

FriendRemovePacket.prototype = Object.create(PacketWriter.prototype);
FriendRemovePacket.prototype.constructor = FriendRemovePacket;

const FriendAddPacket = function (string) {

  /*
   * Class LogoutPacket
   * Wrapper for logout request for the player
   */

  let { stringEncoded, stringLength } = this.encodeString(string);

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.FRIEND_ADD, stringLength);

  this.writeBuffer(stringEncoded);

}

FriendAddPacket.prototype = Object.create(PacketWriter.prototype);
FriendAddPacket.prototype.constructor = FriendAddPacket;

const OfferBuyPacket = function (id, offer, count) {

  /*
   * Class OfferBuyPacket
   * Wrapper for logout request for the player
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.BUY_OFFER, 6);

  this.writeUInt32(id);
  this.writeUInt8(offer);
  this.writeUInt8(count);

}

OfferBuyPacket.prototype = Object.create(PacketWriter.prototype);
OfferBuyPacket.prototype.constructor = OfferBuyPacket;

const OfferSellPacket = function (id, offer, count) {

  /*
   * Class OfferSellPacket
   * Wrapper for player selling an item to the NPC
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.SELL_OFFER, 6);

  this.writeUInt32(id);
  this.writeUInt8(offer);
  this.writeUInt8(count);

}

OfferSellPacket.prototype = Object.create(PacketWriter.prototype);
OfferSellPacket.prototype.constructor = OfferSellPacket;

const SpellCastPacket = function (id) {

  /*
   * Class SpellCastPacket
   * Wrapper for logout request for the player
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CAST_SPELL, 2);

  this.writeUInt16(id);

}

SpellCastPacket.prototype = Object.create(PacketWriter.prototype);
SpellCastPacket.prototype.constructor = SpellCastPacket;

const LatencyPacket = function () {

  /*
   * Class LatencyPacket
   * Wrapper for logout request for the player
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.LATENCY, 0);

}

LatencyPacket.prototype = Object.create(PacketWriter.prototype);
LatencyPacket.prototype.constructor = LatencyPacket;

const FightModePacket = function (mode) {

  /*
   * Class FightModePacket
   * Wrapper for fight mode change packet (OFFENSIVE, BALANCED, DEFENSIVE)
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.FIGHT_MODE, 1);

  this.writeUInt8(mode);

}

FightModePacket.prototype = Object.create(PacketWriter.prototype);
FightModePacket.prototype.constructor = FightModePacket;

const ChaseModePacket = function (mode) {

  /*
   * Class ChaseModePacket
   * Wrapper for chase mode change packet (STAND, CHASE)
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.CHASE_MODE, 1);

  this.writeUInt8(mode);

}

ChaseModePacket.prototype = Object.create(PacketWriter.prototype);
ChaseModePacket.prototype.constructor = ChaseModePacket;

const WriteTextPacket = function (itemId, content) {

  /*
   * Class WriteTextPacket
   * Wrapper for sending written text content to the server (labels, letters, etc.)
   */

  let encodedContent = this.encodeString(content);

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.WRITE_TEXT, 4 + encodedContent.stringLength);

  this.writeUInt32(itemId);
  this.writeBuffer(encodedContent.stringEncoded);

}

WriteTextPacket.prototype = Object.create(PacketWriter.prototype);
WriteTextPacket.prototype.constructor = WriteTextPacket;

const QuestLogPacket = function (questId) {
  /*
   * Class QuestLogPacket
   * Wrapper for requesting quest log or specific quest details
   * If questId is provided, it requests details for that quest (QuestLine)
   * If questId is 0 or undefined, it requests the main list
   */

  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.QUEST_LOG, 2);

  this.writeUInt16(questId || 0);

}
QuestLogPacket.prototype = Object.create(PacketWriter.prototype);
QuestLogPacket.prototype.constructor = QuestLogPacket;

const PartyInvitePacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.PARTY_INVITE, stringLength);
  this.writeBuffer(stringEncoded);
};
PartyInvitePacket.prototype = Object.create(PacketWriter.prototype);
PartyInvitePacket.prototype.constructor = PartyInvitePacket;

const PartyJoinPacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.PARTY_JOIN, stringLength);
  this.writeBuffer(stringEncoded);
};
PartyJoinPacket.prototype = Object.create(PacketWriter.prototype);
PartyJoinPacket.prototype.constructor = PartyJoinPacket;

const PartyLeavePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.PARTY_LEAVE, 0);
};
PartyLeavePacket.prototype = Object.create(PacketWriter.prototype);
PartyLeavePacket.prototype.constructor = PartyLeavePacket;

const PartyKickPacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.PARTY_KICK, stringLength);
  this.writeBuffer(stringEncoded);
};
PartyKickPacket.prototype = Object.create(PacketWriter.prototype);
PartyKickPacket.prototype.constructor = PartyKickPacket;

const PartyPassLeadershipPacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.PARTY_PASS_LEADERSHIP, stringLength);
  this.writeBuffer(stringEncoded);
};
PartyPassLeadershipPacket.prototype = Object.create(PacketWriter.prototype);
PartyPassLeadershipPacket.prototype.constructor = PartyPassLeadershipPacket;

const OracleSelectionPacket = function (npcId, vocationId, townId) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.ORACLE_SELECTION, 6);
  this.writeUInt32(npcId);
  this.writeUInt8(vocationId);
  this.writeUInt8(townId);
};
OracleSelectionPacket.prototype = Object.create(PacketWriter.prototype);
OracleSelectionPacket.prototype.constructor = OracleSelectionPacket;

const BlessingBuyPacket = function (blessingIndex, currency) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.BUY_BLESSING, 2);
  this.writeUInt8(blessingIndex);
  this.writeUInt8(currency || 0);
};
BlessingBuyPacket.prototype = Object.create(PacketWriter.prototype);
BlessingBuyPacket.prototype.constructor = BlessingBuyPacket;

const GuildRequestInfoPacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_REQUEST_INFO, 0);
};
GuildRequestInfoPacket.prototype = Object.create(PacketWriter.prototype);
GuildRequestInfoPacket.prototype.constructor = GuildRequestInfoPacket;

const GuildDepositPacket = function (amount) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_DEPOSIT, 4);
  this.writeUInt32(amount);
};
GuildDepositPacket.prototype = Object.create(PacketWriter.prototype);
GuildDepositPacket.prototype.constructor = GuildDepositPacket;

const GuildWithdrawPacket = function (amount) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_WITHDRAW, 4);
  this.writeUInt32(amount);
};
GuildWithdrawPacket.prototype = Object.create(PacketWriter.prototype);
GuildWithdrawPacket.prototype.constructor = GuildWithdrawPacket;

const GuildRenamePacket = function (newName) {
  let { stringEncoded, stringLength } = this.encodeString(newName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_RENAME, stringLength);
  this.writeBuffer(stringEncoded);
};
GuildRenamePacket.prototype = Object.create(PacketWriter.prototype);
GuildRenamePacket.prototype.constructor = GuildRenamePacket;

const GuildSetRankPacket = function (playerName, newRank) {
  let { stringEncoded, stringLength } = this.encodeString(playerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_SET_RANK, stringLength + 1);
  this.writeBuffer(stringEncoded);
  this.writeUInt8(newRank);
};
GuildSetRankPacket.prototype = Object.create(PacketWriter.prototype);
GuildSetRankPacket.prototype.constructor = GuildSetRankPacket;

const GuildRemoveMemberPacket = function (playerName) {
  let { stringEncoded, stringLength } = this.encodeString(playerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_REMOVE_MEMBER, stringLength);
  this.writeBuffer(stringEncoded);
};
GuildRemoveMemberPacket.prototype = Object.create(PacketWriter.prototype);
GuildRemoveMemberPacket.prototype.constructor = GuildRemoveMemberPacket;

const GuildDeletePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_DELETE, 0);
};
GuildDeletePacket.prototype = Object.create(PacketWriter.prototype);
GuildDeletePacket.prototype.constructor = GuildDeletePacket;

const GuildDeclareWarPacket = function (enemyName) {
  let { stringEncoded, stringLength } = this.encodeString(enemyName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_DECLARE_WAR, stringLength);
  this.writeBuffer(stringEncoded);
};
GuildDeclareWarPacket.prototype = Object.create(PacketWriter.prototype);
GuildDeclareWarPacket.prototype.constructor = GuildDeclareWarPacket;

const GuildInvitePacket = function (playerName) {
  let { stringEncoded, stringLength } = this.encodeString(playerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_INVITE, stringLength);
  this.writeBuffer(stringEncoded);
};
GuildInvitePacket.prototype = Object.create(PacketWriter.prototype);
GuildInvitePacket.prototype.constructor = GuildInvitePacket;

const GuildSetTitlePacket = function (playerName, title) {
  let { stringEncoded: nameEncoded, stringLength: nameLength } = this.encodeString(playerName);
  let { stringEncoded: titleEncoded, stringLength: titleLength } = this.encodeString(title);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.GUILD_SET_TITLE, nameLength + titleLength);
  this.writeBuffer(nameEncoded);
  this.writeBuffer(titleEncoded);
};
GuildSetTitlePacket.prototype = Object.create(PacketWriter.prototype);
GuildSetTitlePacket.prototype.constructor = GuildSetTitlePacket;

const HouseBuyPacket = function (houseId) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_BUY, 4);
  this.writeUInt32(houseId);
};
HouseBuyPacket.prototype = Object.create(PacketWriter.prototype);
HouseBuyPacket.prototype.constructor = HouseBuyPacket;

const HouseBuyOutrightPacket = function (houseId) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_BUY_OUTRIGHT, 4);
  this.writeUInt32(houseId);
};
HouseBuyOutrightPacket.prototype = Object.create(PacketWriter.prototype);
HouseBuyOutrightPacket.prototype.constructor = HouseBuyOutrightPacket;

const HouseInvitePacket = function (playerName) {
  let { stringEncoded, stringLength } = this.encodeString(playerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_INVITE, stringLength);
  this.writeBuffer(stringEncoded);
};
HouseInvitePacket.prototype = Object.create(PacketWriter.prototype);
HouseInvitePacket.prototype.constructor = HouseInvitePacket;

const HouseRemoveGuestPacket = function (playerName) {
  let { stringEncoded, stringLength } = this.encodeString(playerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_REMOVE_GUEST, stringLength);
  this.writeBuffer(stringEncoded);
};
HouseRemoveGuestPacket.prototype = Object.create(PacketWriter.prototype);
HouseRemoveGuestPacket.prototype.constructor = HouseRemoveGuestPacket;

const HouseSellPacket = function (buyerName) {
  let { stringEncoded, stringLength } = this.encodeString(buyerName);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_SELL, stringLength);
  this.writeBuffer(stringEncoded);
};
HouseSellPacket.prototype = Object.create(PacketWriter.prototype);
HouseSellPacket.prototype.constructor = HouseSellPacket;

const HouseSetRentPacket = function (price) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_SET_RENT, 4);
  this.writeUInt32(price);
};
HouseSetRentPacket.prototype = Object.create(PacketWriter.prototype);
HouseSetRentPacket.prototype.constructor = HouseSetRentPacket;

const HouseSetListingPacket = function (price) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_SET_LISTING, 4);
  this.writeUInt32(price);
};
HouseSetListingPacket.prototype = Object.create(PacketWriter.prototype);
HouseSetListingPacket.prototype.constructor = HouseSetListingPacket;

const HouseConfirmRentPacket = function (price) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.HOUSE_CONFIRM_RENT, 4);
  this.writeUInt32(price);
};
HouseConfirmRentPacket.prototype = Object.create(PacketWriter.prototype);
HouseConfirmRentPacket.prototype.constructor = HouseConfirmRentPacket;

const TradeRequestPacketClient = function (targetId) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_REQUEST, 4);
  this.writeUInt32(targetId);
};
TradeRequestPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeRequestPacketClient.prototype.constructor = TradeRequestPacketClient;

const TradeAcceptPacketClient = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_ACCEPT, 0);
};
TradeAcceptPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeAcceptPacketClient.prototype.constructor = TradeAcceptPacketClient;

const TradeRejectPacketClient = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_REJECT, 0);
};
TradeRejectPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeRejectPacketClient.prototype.constructor = TradeRejectPacketClient;

const TradeAddItemPacketClient = function (containerId, slotIndex, count) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_ADD_ITEM, 3);
  this.writeUInt8(containerId);
  this.writeUInt8(slotIndex);
  this.writeUInt8(count || 1);
};
TradeAddItemPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeAddItemPacketClient.prototype.constructor = TradeAddItemPacketClient;

const TradeRemoveItemPacketClient = function (slotIndex) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_REMOVE_ITEM, 1);
  this.writeUInt8(slotIndex);
};
TradeRemoveItemPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeRemoveItemPacketClient.prototype.constructor = TradeRemoveItemPacketClient;

const TradeSetGoldPacketClient = function (amount) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_SET_GOLD, 4);
  this.writeUInt32(amount);
};
TradeSetGoldPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeSetGoldPacketClient.prototype.constructor = TradeSetGoldPacketClient;

const TradeConfirmPacketClient = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.TRADE_CONFIRM, 0);
};
TradeConfirmPacketClient.prototype = Object.create(PacketWriter.prototype);
TradeConfirmPacketClient.prototype.constructor = TradeConfirmPacketClient;

const IgnoreAddPacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.IGNORE_ADD, stringLength);
  this.writeBuffer(stringEncoded);
};
IgnoreAddPacket.prototype = Object.create(PacketWriter.prototype);
IgnoreAddPacket.prototype.constructor = IgnoreAddPacket;

const IgnoreRemovePacket = function (name) {
  let { stringEncoded, stringLength } = this.encodeString(name);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.IGNORE_REMOVE, stringLength);
  this.writeBuffer(stringEncoded);
};
IgnoreRemovePacket.prototype = Object.create(PacketWriter.prototype);
IgnoreRemovePacket.prototype.constructor = IgnoreRemovePacket;

const IgnoreListRequestPacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.IGNORE_LIST, 0);
};
IgnoreListRequestPacket.prototype = Object.create(PacketWriter.prototype);
IgnoreListRequestPacket.prototype.constructor = IgnoreListRequestPacket;

const VoiceDataPacket = function (audioData) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.VOICE_DATA, 2 + audioData.length);
  this.writeUInt16(audioData.length);
  this.writeBuffer(audioData);
};
VoiceDataPacket.prototype = Object.create(PacketWriter.prototype);
VoiceDataPacket.prototype.constructor = VoiceDataPacket;

const MarketStartPacket = function (shopName, items) {
  let enc = this.encodeString(shopName || "");
  let totalLength = enc.stringLength + 1 + items.length * 11;
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.MARKET_START, totalLength);
  this.writeUInt8(enc.stringEncoded.length);
  this.set(enc.stringEncoded);
  this.writeUInt8(items.length);
  items.forEach(function (item) {
    this.writeUInt16(item.id);
    this.writeUInt8(item.count || 1);
    this.writeUInt32(item.priceGold || 0);
    this.writeUInt32(item.priceRetro || 0);
  }, this);
};
MarketStartPacket.prototype = Object.create(PacketWriter.prototype);
MarketStartPacket.prototype.constructor = MarketStartPacket;

const MarketRequestViewPacket = function (sellerId) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.MARKET_REQUEST_VIEW, 4);
  this.writeUInt32(sellerId);
};
MarketRequestViewPacket.prototype = Object.create(PacketWriter.prototype);
MarketRequestViewPacket.prototype.constructor = MarketRequestViewPacket;

const MarketClosePacket = function () {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.MARKET_CLOSE, 0);
};
MarketClosePacket.prototype = Object.create(PacketWriter.prototype);
MarketClosePacket.prototype.constructor = MarketClosePacket;

const MarketBuyPacket = function (sellerId, itemIndex, count, useRetro) {
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.MARKET_BUY, 7);
  this.writeUInt32(sellerId);
  this.writeUInt8(itemIndex);
  this.writeUInt8(count);
  this.writeBoolean(useRetro);
};
MarketBuyPacket.prototype = Object.create(PacketWriter.prototype);
MarketBuyPacket.prototype.constructor = MarketBuyPacket;

const AdminAddSkillSubmitPacket = function (playerName, skills, value) {
  let data = JSON.stringify({ playerName: playerName, skills: skills, value: value });
  let { stringEncoded, stringLength } = this.encodeString(data);
  PacketWriter.call(this, CONST.PROTOCOL.CLIENT.ADMIN_ADD_SKILL_SUBMIT, stringLength);
  this.writeBuffer(stringEncoded);
};
AdminAddSkillSubmitPacket.prototype = Object.create(PacketWriter.prototype);
AdminAddSkillSubmitPacket.prototype.constructor = AdminAddSkillSubmitPacket;
