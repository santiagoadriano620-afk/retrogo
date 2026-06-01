const Condition = requireModule("combat/condition");
const { EmotePacket, FoodTimerPacket } = requireModule("network/protocol");

// Add this to the item definitions?
const lookup = new Object({
  "2362": { "ticks": 160, "sound": "Crunch." }, // carrot (96s)
  "2666": { "ticks": 300, "sound": "Munch." }, // meat (180s)
  "2667": { "ticks": 240, "sound": "Munch." }, // fish (144s)
  "2668": { "ticks": 200, "sound": "Mmmm." }, // salmon (120s)
  "2669": { "ticks": 340, "sound": "Munch." }, // northern pike (204s)
  "2670": { "ticks": 80, "sound": "Gulp." }, // shrimp (48s)
  "2671": { "ticks": 600, "sound": "Chomp." }, // ham (360s)
  "2672": { "ticks": 1200, "sound": "Chomp." }, // dragon ham (720s)
  "2673": { "ticks": 100, "sound": "Yum." }, // pear (60s)
  "2674": { "ticks": 120, "sound": "Yum." }, // red apple (72s)
  "2675": { "ticks": 260, "sound": "Yum." }, // orange (156s)
  "2676": { "ticks": 160, "sound": "Yum." }, // banana (96s)
  "2677": { "ticks": 20, "sound": "Yum." }, // blueberry (12s)
  "2678": { "ticks": 360, "sound": "Slurp." }, // coconut (216s)
  "2679": { "ticks": 20, "sound": "Yum." }, // cherry (12s)
  "2680": { "ticks": 40, "sound": "Yum." }, // strawberry (24s)
  "2681": { "ticks": 180, "sound": "Yum." }, // grapes (108s)
  "2682": { "ticks": 400, "sound": "Yum." }, // melon (240s)
  "2683": { "ticks": 340, "sound": "Munch." }, // pumpkin (204s)
  "2684": { "ticks": 160, "sound": "Crunch." }, // carrot (96s)
  "2685": { "ticks": 120, "sound": "Munch." }, // tomato (72s)
  "2686": { "ticks": 180, "sound": "Crunch." }, // corncob (108s)
  "2687": { "ticks": 40, "sound": "Crunch." }, // cookie (24s)
  "2688": { "ticks": 40, "sound": "Munch." }, // candy cane (24s)
  "2689": { "ticks": 200, "sound": "Crunch." }, // bread (120s)
  "2690": { "ticks": 60, "sound": "Crunch." }, // roll (36s)
  "2691": { "ticks": 160, "sound": "Crunch." }, // brown bread (96s)
  "2695": { "ticks": 120, "sound": "Gulp." }, // egg (72s)
  "2696": { "ticks": 180, "sound": "Smack." }, // cheese (108s)
  "2787": { "ticks": 180, "sound": "Munch." }, // white mushroom (108s)
  "2788": { "ticks": 80, "sound": "Munch." }, // red mushroom (48s)
  "2789": { "ticks": 440, "sound": "Munch." }, // brown mushroom (264s)
  "2790": { "ticks": 600, "sound": "Munch." }, // orange mushroom (360s)
  "2791": { "ticks": 180, "sound": "Munch." }, // wood mushroom (108s)
  "2792": { "ticks": 120, "sound": "Munch." }, // dark mushroom (72s)
  "2793": { "ticks": 240, "sound": "Munch." }, // some mushrooms (144s)
  "2794": { "ticks": 60, "sound": "Munch." }, // some mushrooms (36s)
  "2795": { "ticks": 720, "sound": "Munch." }, // fire mushroom (432s)
  "2796": { "ticks": 100, "sound": "Munch." } // green mushroom (60s)
})

module.exports = function playerEatFood(player, thing, index, item) {

  /*
   * Function playerEatFood
   * Writes a little text message and removes one of the item
   */

  // Does not exist
  if (!lookup.hasOwnProperty(item.id)) {
    return false;
  }

  let { ticks, sound } = lookup[item.id];

  // Block if adding this food would exceed the 20-minute cap (2000 ticks)
  if (player.isSated(ticks)) {
    return player.sendCancelMessage("You are full.");
  }

  // Extend the SATED condition (blocks further eating while active)
  // SATED onTick handles HP/MP regeneration (1 HP + 1 MP per 600ms tick)
  player.extendCondition(Condition.prototype.SATED, ticks, 600, null);

  // Send food timer update to client (total remaining seconds)
  let satedCondition = player.conditions.__conditions.get(Condition.prototype.SATED);
  if (satedCondition) {
    let remainingSeconds = Math.floor((satedCondition.numberTicks * 600) / 1000);
    player.write(new FoodTimerPacket(remainingSeconds));
  }

  player.broadcast(new EmotePacket(player, sound, CONST.COLOR.ORANGE));

  // Refactor
  thing.removeIndex(index, 1);

}