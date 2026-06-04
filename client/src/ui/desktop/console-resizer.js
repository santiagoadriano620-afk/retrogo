const ConsoleResizer = function() {

  this.tabbar = document.getElementById("console-tabbar");
  this.lower = document.querySelector(".lower");

  if(!this.tabbar || !this.lower) return;

  this.isResizing = false;
  this.startY = 0;
  this.startHeight = 0;
  this.minHeight = 50;
  // Guarda a altura inicial do .lower (do CSS) como teto máximo
  this.ceiling = (this.lower.getBoundingClientRect().height || 140) + 7;

  this.tabbar.addEventListener("mousedown", this.__onMouseDown.bind(this));
  document.addEventListener("mousemove", this.__onMouseMove.bind(this));
  document.addEventListener("mouseup", this.__onMouseUp.bind(this));

}

ConsoleResizer.prototype.__onMouseDown = function(event) {

  this.isResizing = true;
  this.startY = event.clientY;
  this.startHeight = this.lower.offsetHeight;
  this.wrapper = document.getElementById("game-wrapper");
  // Garante que o teto nunca trava abaixo do startHeight (caso o .lower já tenha sido redimensionado)
  this.ceiling = Math.max(this.ceiling, this.startHeight);

  document.body.style.cursor = "ns-resize";
  this.lower.classList.add("resizing");

  event.preventDefault();

}

ConsoleResizer.prototype.__onMouseMove = function(event) {

  if(!this.isResizing) return;

  event.preventDefault();

  const deltaY = this.startY - event.clientY;
  let newHeight = this.startHeight + deltaY;

  if(newHeight < this.minHeight) newHeight = this.minHeight;
  if(newHeight > this.ceiling) newHeight = this.ceiling;

  this.lower.style.height = newHeight + "px";

}

ConsoleResizer.prototype.__onMouseUp = function(event) {

  if(this.isResizing) {
    this.isResizing = false;
    document.body.style.cursor = "default";
    this.lower.classList.remove("resizing");
  }

}
