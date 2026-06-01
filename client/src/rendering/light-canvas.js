"use strict";

var LightCanvas = function(id, width, height) {

  /*
   * Class LightCanvas
   * Container for a canvas that handles lighting
   */

  // Inherits from canvas
  Canvas.call(this, id, width, height);

  // Current state of the light canvas and start, target for interpolation
  this.__ambientColor = new RGBA(0, 0, 0, 0);
  this.__ambientColorTarget = new RGBA(0, 0, 0, 0);
  this.__ambientColorStart = new RGBA(0, 0, 0, 0);

  this.__counter = 0;
  this.__steps = 0;

  this.__isUnderground = false;

  this.__preRenderAmbientBubble();

}

LightCanvas.prototype = Object.create(Canvas.prototype);
LightCanvas.prototype.constructor = LightCanvas;

LightCanvas.prototype.__preRenderAmbientBubble = function() {

  let size = Math.ceil(2.5 * 32);
  this.__cachedAmbientBubble = document.createElement("canvas");
  this.__cachedAmbientBubble.width = size * 2;
  this.__cachedAmbientBubble.height = size * 2;
  let ctx = this.__cachedAmbientBubble.getContext("2d");

  let cx = size, cy = size;
  let r = 51 * (parseInt(210 / 36) % 6);
  let g = 51 * (parseInt(210 / 6) % 6);
  let b = 51 * (parseInt(210 % 6));
  let carveAlpha = Math.floor(0xFF * 0.15);

  let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
  grad.addColorStop(0.00, new RGBA(r, g, b, carveAlpha).toString());
  grad.addColorStop(0.25, new RGBA(r, g, b, Math.floor(carveAlpha * 0.75)).toString());
  grad.addColorStop(0.50, new RGBA(r, g, b, Math.floor(carveAlpha * 0.50)).toString());
  grad.addColorStop(0.75, new RGBA(r, g, b, Math.floor(carveAlpha * 0.25)).toString());
  grad.addColorStop(1.00, "rgba(0,0,0,0)");

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size * 2, size * 2);

}

// Darkness is black
LightCanvas.prototype.DARKNESS = new RGBA(0, 0, 0, 255);
LightCanvas.prototype.CAVE_DARKNESS = new RGBA(0, 0, 0, 248);

LightCanvas.prototype.setAmbientColor = function(r, g, b, a) {

  this.__ambientColorTarget = new RGBA(r, g, b, a);
  this.__ambientColorStart = this.__ambientColor.copy();

  let f1 = Math.abs(this.__ambientColorStart.r - this.__ambientColorTarget.r);
  let f2 = Math.abs(this.__ambientColorStart.g - this.__ambientColorTarget.g);
  let f3 = Math.abs(this.__ambientColorStart.b - this.__ambientColorTarget.b);
  let f4 = Math.abs(this.__ambientColorStart.a - this.__ambientColorTarget.a);

  this.__steps = Math.max(1, Math.min(60, 2 * Math.max(f1, f2, f3, f4)));
  this.__counter = this.__steps;

}

LightCanvas.prototype.getNightSine = function() {

  /*
   * Function LightCanvas.getNightSine
   * Returns the fraction of the night proportion. Nights are simulated using a sine-wave from -1 to 1 over a particular period
   */

  // Read the world time from the clock
  let unix = gameClient.world.clock.getUnix();

  // Calculate the sine but give it an 1/8th PI offset
  return Math.sin(0.25 * Math.PI + (2 * Math.PI * unix / (24 * 60 * 60 * 1000)));

}

LightCanvas.prototype.getDarknessFraction = function() {

  /*
   * Function LightCanvas.getDarknessFraction
   * Returns the night fraction
   */

  // Simulate the day & night cycle
  let fraction = (0.5 * (this.getNightSine() + 1));

  // Underground is always in full darkness
  if(gameClient.player.isUnderground()) {
    fraction = 1;
  }

  return fraction;

}

LightCanvas.prototype.getInterpolationFraction = function() {

  if (this.__steps === 0) return 0;
  return (this.__counter) / this.__steps;

}

LightCanvas.prototype.update = function() {

  let isUnderground = gameClient.player.isUnderground();

  if (isUnderground !== this.__isUnderground) {
    this.__isUnderground = isUnderground;
    if (isUnderground) {
      this.__ambientColorTarget = new RGBA(0, 0, 0, 248);
      this.__ambientColor = new RGBA(0, 0, 0, 248);
      this.__ambientColorStart = new RGBA(0, 0, 0, 248);
      this.__counter = 0;
      this.__steps = 0;
    } else {
      this.setAmbientColor(0, 0, 0, 0);
    }
  }

  if (this.__counter > 0) {
    let frac = this.getInterpolationFraction();
    this.__ambientColor.r = Math.round(frac * this.__ambientColorStart.r + (1 - frac) * this.__ambientColorTarget.r);
    this.__ambientColor.g = Math.round(frac * this.__ambientColorStart.g + (1 - frac) * this.__ambientColorTarget.g);
    this.__ambientColor.b = Math.round(frac * this.__ambientColorStart.b + (1 - frac) * this.__ambientColorTarget.b);
    this.__ambientColor.a = Math.round(frac * this.__ambientColorStart.a + (1 - frac) * this.__ambientColorTarget.a);
    this.__counter--;
  } else {
    this.__ambientColor.r = this.__ambientColorTarget.r;
    this.__ambientColor.g = this.__ambientColorTarget.g;
    this.__ambientColor.b = this.__ambientColorTarget.b;
    this.__ambientColor.a = this.__ambientColorTarget.a;
  }

}

LightCanvas.prototype.setup = function() {

  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

  let alpha = this.__ambientColor.a;
  if (alpha > 0) {
    this.context.globalCompositeOperation = "source-over";
    this.context.fillStyle = this.__ambientColor.toString();
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

}

LightCanvas.prototype.render = function() {

  /*
   * Function LightCanvas.render
   * Called after all light bubbles have been drawn to finalize the lightscreen
   */

  // Invalidate WebGL texture cache: light canvas content changes every frame
  this.canvas.__glTexGen = (this.canvas.__glTexGen || 0) + 1;

}

LightCanvas.prototype.renderLightBubble = function(x, y, size, colorByte, level, carvePct) {

  // Scale to the gamescreen (center of tile)
  x = 32 * x + 16;
  y = 32 * y + 16;
  size *= 32;

  if(colorByte < 0 || colorByte >= 216) {
    return;
  }

  carvePct = carvePct || (level != null ? Math.min(0.80, 0.40 + level * 0.01) : 0.50);

  // Use pre-rendered ambient bubble when parameters match (center, color 210, carve 15%)
  if (this.__cachedAmbientBubble && colorByte === 210 && carvePct === 0.15 && size === 80) {
    this.context.globalCompositeOperation = "destination-out";
    this.context.drawImage(this.__cachedAmbientBubble, x - 80, y - 80);
    this.context.globalCompositeOperation = "source-over";
    return;
  }

  let carveAlpha = Math.floor(0xFF * carvePct);

  // Use the gradient for smooth falloff
  let r = 51 * (parseInt(colorByte / 36) % 6);
  let g = 51 * (parseInt(colorByte / 6) % 6);
  let b = 51 * (parseInt(colorByte % 6));
  let radgrad = this.context.createRadialGradient(x, y, 0, x, y, size);
  radgrad.addColorStop(0.00, new RGBA(r, g, b, carveAlpha).toString());
  radgrad.addColorStop(0.25, new RGBA(r, g, b, Math.floor(carveAlpha * 0.75)).toString());
  radgrad.addColorStop(0.50, new RGBA(r, g, b, Math.floor(carveAlpha * 0.50)).toString());
  radgrad.addColorStop(0.75, new RGBA(r, g, b, Math.floor(carveAlpha * 0.25)).toString());
  radgrad.addColorStop(1.00, new RGBA(0, 0, 0, 0).toString());

  this.context.globalCompositeOperation = "destination-out";
  this.context.beginPath();
  this.context.fillStyle = radgrad;
  this.context.arc(x, y, size, 0, 2 * Math.PI, false);
  this.context.fill();

}
