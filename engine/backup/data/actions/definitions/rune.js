module.exports = function useRuneWith(player, item, tile) {
  let from = player.position;
  let to = tile.position;

  if (!from.inLineOfSight(to)) {
    return player.sendCancelMessage("Target is not in line of sight.");
  }

  let rune = process.gameServer.database.getRune(item.id);

  if (rune === null) {
    return player.sendCancelMessage("The rune does nothing.");
  }

  try {
    rune.call(null, player, tile);
  } catch (e) {
    console.error("Rune script error:", e);
  }

  item.charges = (item.charges || 1) - 1;
  if (item.charges <= 0) {
    try {
      item.removeCount(1);
    } catch (e) {
      console.error("Rune remove error:", e);
    }
  }
}
