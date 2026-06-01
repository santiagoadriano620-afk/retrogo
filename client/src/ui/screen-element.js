const ScreenElement = function (id) {

  /*
   * Class ScreenElement
   * Base class for DOM elements on the game screen
   *
   * API:
   *
   * ScreenElement.remove() - removes the screen element DOM
   * ScreenElement.hide() - hides the screen element DOM
   * ScreenElement.show() - shows the screen element DOM
   *
   */

  // Specific classes implement and create the element
  this.element = document.getElementById(id).cloneNode(true);

  // Show the element when it is spawned
  this.show();

}

ScreenElement.prototype.remove = function () {

  /*
   * Function ScreenElement.remove
   * Removes the element from the DOM
   */

  this.element.remove();

}

ScreenElement.prototype.hide = function () {

  /*
   * Function ScreenElement.hide
   * Hides the element from the game screen
   */

  this.element.style.display = "none";

}

ScreenElement.prototype.show = function () {

  /*
   * Function ScreenElement.show
   * Shows the element on the game screen
   */

  this.element.style.display = "block";

}

ScreenElement.prototype.__updateTextPosition = function (offset) {

  /*
   * Function ScreenElement.__updateTextPosition
   * Actually applies the transform
   */

  // Set the style to transform (no clamping to see actual position)
  this.element.style.transform = "translate(" + offset.left + "px, " + offset.top + "px)";

  this.show();

}

ScreenElement.prototype.__getAbsoluteOffset = function (position) {

  /*
   * Function ScreenElement.__getAbsoluteOffset
   * Returns the offset of the screen element based on its properties and the screen size
   */

  // Determine the fraction based on the size of the screen
  let scale = gameClient.interface.getSpriteScalingVector();

  // Canvas transform-origin is at grid (14, 7) = pixel (448, 224)
  // The CSS scale() with this transform-origin keeps (14, 7) fixed
  // Nameplates must offset from this fixed point, not from (0,0)
  let left = (position.x - 14) * scale.x + 448 - (0.5 * this.element.offsetWidth);
  let top = (position.y - 7) * scale.y + 224 - (0.5 * this.element.offsetHeight);

  // Fullscreen offset compensation
  if (!!(document.fullscreenElement || document.webkitFullscreenElement)) {
    left += 40 * (scale.x / 32);
    top += 70;
  }

  // Return the new offsets
  return { left, top }

}