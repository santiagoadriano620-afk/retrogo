"use strict";

const ActionLoader = function() {

  /*
   * Function ActionLoader
   * Class that handles the management of user-defined actions
   */

  this.__uniqueActions = new Map();

}

ActionLoader.prototype.initialize = function() {

  /*
   * Function ActionLoader.initialize
   * Initializes the action loader and loads data from disk
   */

  // Three different types
  // - Unique actions apply to a single instance of an item
  // - Prototype actions apply to the prototype of a single item and hence all items of that type
  // - Clock actions subscribe to the world clock and are executed every game time tick
  this.__attachUniqueEvents("unique");
  this.__attachPrototypeEvents("actions");

}

ActionLoader.prototype.__attachUniqueEvents = function(filepath) {

  /*
   * Function ActionLoader.__attachUniqueEvents
   * Loads the configured unique actions
   */

  // Save all definitions
  gameServer.database.readDataDefinition(filepath).forEach(function(definition) {

    let callback = require(getDataFile(filepath, "definitions", definition.callback))

    // Create a bucket to collect the functions
    if(!this.__uniqueActions.has(definition.uid)) {
      this.__uniqueActions.set(definition.uid, new Array());
    }
        
    // Can be multiple actions
    this.__uniqueActions.get(definition.uid).push({
      "on": definition.on,
      "callback": callback
    });

  }, this);

  console.log("Attached [[ %s ]] unique action listeners.".format(this.__uniqueActions.size));

}

ActionLoader.prototype.attachClockEvents = function(filepath) {

  /*
   * Function ActionLoader.attachClockEvents
   * Attaches timed events to the world
   */

  // Save all definitions
  gameServer.database.readDataDefinition(filepath).forEach(function(definition) {
    let callback = require(getDataFile(filepath, "definitions", definition.callback));
    gameServer.world.clock.on("time", callback);
  }, this);

}

ActionLoader.prototype.__attachPrototypeEvents = function(filepath) {

  /*
   * Function ActionLoader.__attachPrototypeEvents
   * Attaches the configured prototype events that apply to all items of a certain type
   */

  // These are the JSON definitions that configure the action and reference the script
  let definitions = gameServer.database.readDataDefinition(filepath);

  // Read the definition
  definitions.forEach(function(definition) {

    let callback;

    if(definition.type === "transform") {
      let transformMap = {};

      if(definition.ids && definition.ids.length > 0) {
        for(let i = 0; i < definition.ids.length; i += 2) {
          let a = definition.ids[i];
          let b = definition.ids[i + 1];
          if(b !== undefined) {
            transformMap[a] = b;
            transformMap[b] = a;
          }
        }
      } else if(definition.from !== undefined && definition.to !== undefined) {
        for(let i = definition.from; i <= definition.to; i += 2) {
          let a = i;
          let b = i + 1;
          if(b <= definition.to) {
            transformMap[a] = b;
            transformMap[b] = a;
          }
        }
      }

      callback = function(player, tile, index, item) {
        let target = tile && tile.constructor && tile.constructor.name === "Tile"
          ? tile.peekIndex(index) : item;
        if (!target) target = item;

        let newId = transformMap[target.id];
        if (!newId) return false;

        let newThing = process.gameServer.database.createThing(newId);
        if (!newThing) return false;

        if (target.actionId) newThing.setActionId(target.actionId);
        if (target.duration !== undefined && target.duration > 0) {
          newThing.setDuration(target.getRemainingDuration());
        }
        target.replace(newThing);
        return true;
      };
    } else {
      callback = require(getDataFile(filepath, "definitions", definition.callback));
    }

    // The range of item identifiers to apply it to
    let range = new Array();

    // Single, multiple, or range
    if(definition.id) {
      range = [definition.id];
    } else if(definition.ids) {
      range = definition.ids;
    } else if(definition.from && definition.to) {
      range = Array.prototype.range(definition.from, definition.to);
    }
      
    // Attach for __addPrototypeEventListener
    range.forEach(id => {
      let prototype = gameServer.database.getThingPrototype(id);
      if (!prototype) {
        return console.warn("Skipping action for unknown prototype id %s.".format(id));
      }
      prototype.on(definition.on, callback);
    });
  
  });

  console.log("Attached [[ %s ]] prototype event listeners.".format(definitions.length));

}

ActionLoader.prototype.getUniqueActions = function(uid) {

  /*
   * Function ActionLoader.getUniqueActions
   * Returns the configured unique actions for a particular unique identifier
   */

  // Does not exist
  if(!this.__uniqueActions.has(uid)) {
    return null;
  }

  return this.__uniqueActions.get(uid);

}

module.exports = ActionLoader;
