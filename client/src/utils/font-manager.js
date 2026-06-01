const FontManager = function () {
  this.fonts = {};
  this.defaultFont = null;
  this.loaded = false;
  window.fontManager = this;
  window.__bitmapFont = null;
}

new FontManager();
