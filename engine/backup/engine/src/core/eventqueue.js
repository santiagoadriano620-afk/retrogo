"use strict";

const BinaryHeap = requireModule("utils/binary-heap");
const Event = requireModule("utils/event");

const EventQueue = function() {

  /*
   * Class EventQueue
   * Container for priority queuing class based on a binary heap
   * 
   * API:
   * 
   * EventQueue.addEventSeconds(callback, seconds) - Adds an event an approximate number of seconds from now
   * EventQueue.addEventMs(callback, milliseconds) - Adds an event an approximate number of miliseconds from now
   * EventQueue.addEvent(callback, ticks) - Adds an event a number of ticks from now
   * EventQueue.getEventsHandle() - Returns the number of events handled since the last request
   * EventQueue.tick() - Increments the event queue and handles all events that should be handled
   * EventQueue.remove(event) - Removes an event from the event heap by reference
   *
   */

  // Create the binary heap that stores all event
  this.heap = new BinaryHeap();

  // Stat
  this.__handledCounter = 0;

}

EventQueue.prototype.getEventsHandled = function() {

  /*
   * Function EventQueue.getEventsHandled
   * Returns the number of events handled since the last call
   */

  // Reset the counter
  let handled = this.__handledCounter;
  this.__handledCounter = 0;

  return handled;

}

EventQueue.prototype.addEventSeconds = function(callback, seconds) {

  /*
   * Function EventQueue.addEventSeconds
   * Adds an event that fires a number of seconds from now
   */

  // Number of seconds
  return this.addEventMs(callback, 1000 * seconds);

}

EventQueue.prototype.addEventMs = function(callback, milliseconds) {

  /*
   * Function EventQueue.addEventMs
   * Adds an event a number of milliseconds from now
   */

  // Number of ticks
  return this.addEvent(callback, Math.floor(milliseconds / CONFIG.SERVER.MS_TICK_INTERVAL));

}

EventQueue.prototype.addEvent = function(callback, ticks) {

  /*
   * Function EventQueue.addEvent
   * Adds an event a number of ticks from now
   */

  // Must be at least a single frame in to the future otherwise the server may get in to an infinite blocking loop
  let future = Math.round(Math.max(ticks, 1));

  if(!Number.isInteger(future)) {
    console.error("Cannot add event with non-integer future %s".format(future));
    return null;
  }

  // Calculate the frame to execute the callback function on
  let scheduledFrame = gameServer.gameLoop.getCurrentFrame() + future;

  // Wrap in the event class
  let heapEvent = new Event(callback, scheduledFrame);

  // Add the event to the heap
  this.heap.push(heapEvent);
  
  // Return the event to reference
  return heapEvent;

}

EventQueue.prototype.tick = function() {
  
  // Current frame
  let currentFrame = gameServer.gameLoop.getCurrentFrame();

  // Limit events per tick to prevent lag spikes
  let eventsThisTick = 0;
  const MAX_EVENTS_PER_TICK = 500;

  while(true) {
    
    if(this.heap.isEmpty()) {
      return;
    }
    
    if(this.heap.hasExecutedUntil(currentFrame)) {
      return;
    }
    
    // Enforce max events per tick
    if (eventsThisTick >= MAX_EVENTS_PER_TICK) {
      return;
    }
    
    let nextEvent = this.heap.pop();

    if(nextEvent.isCancelled()) {
      continue;
    }

    this.__handledCounter++;
    eventsThisTick++;

    nextEvent.callback();
  
  }

}

EventQueue.prototype.remove = function(event) {

  /*
   * Function EventQueue.remove
   * Actually removes an event from the event queue: this is an expensive operation
   */

  this.heap.remove(event);

}

module.exports = EventQueue;
