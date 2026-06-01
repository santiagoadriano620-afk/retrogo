const BitmapFont = function (config) {

  this.canvas = document.createElement("canvas");
  this.ctx = this.canvas.getContext("2d");
  this.name = config.name || "unknown";
  this.glyphWidth = config.glyphWidth || 8;
  this.glyphHeight = config.glyphHeight || 8;
  this.height = config.height || 8;
  this.spaceWidth = config.spaceWidth || 2;
  this.cols = config.cols || 32;
  this.rows = config.rows || 8;
  this.firstChar = config.firstChar || 32;
  this.yOffset = config.yOffset || 0;
  this.spacingX = config.spacingX || 0;
  this.spacingY = config.spacingY || 0;
  this.fixedGlyphWidth = config.fixedGlyphWidth || 0;
  this.loaded = false;
  this.charWidths = new Uint8Array(256);
  this.image = new Image();

  this.image.onload = this.__onImageLoaded.bind(this);
  this.image.src = config.texturePath || ("fonts/" + config.texture + ".png");

}

BitmapFont.prototype.__onImageLoaded = function () {

  this.canvas.width = this.image.width;
  this.canvas.height = this.image.height;

  if (this.cols === 0) {
    this.cols = Math.floor(this.image.width / this.glyphWidth);
  }
  if (this.rows === 0) {
    this.rows = Math.floor(this.image.height / this.glyphHeight);
  }

  this.ctx.drawImage(this.image, 0, 0);
  this.__calculateCharWidths();
  this.loaded = true;

}

BitmapFont.prototype.__calculateCharWidths = function () {

  if (this.fixedGlyphWidth > 0) {
    for (let i = 0; i < 256; i++) {
      this.charWidths[i] = this.fixedGlyphWidth;
    }
    return;
  }

  let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  let pixels = imageData.data;

  for (let i = 0; i < 256; i++) {
    let row = Math.floor((i - this.firstChar) / this.cols);
    let col = (i - this.firstChar) % this.cols;
    if (row < 0 || row >= this.rows) {
      this.charWidths[i] = this.glyphWidth;
      continue;
    }
    let width = 0;
    for (let x = this.glyphWidth - 1; x >= 0; x--) {
      for (let y = 0; y < this.glyphHeight; y++) {
        let px = (row * this.glyphHeight + y) * this.canvas.width + (col * this.glyphWidth + x);
        if (pixels[px * 4 + 3] > 0) {
          width = x + 1;
          break;
        }
      }
      if (width > 0) break;
    }
    this.charWidths[i] = Math.max(width, 1);
  }

}

BitmapFont.prototype.renderText = function (ctx, text, x, y, color) {

  this.__renderTintedGlyphs(ctx, text, x, y, color || "white");

}

BitmapFont.prototype.renderTextWithOutline = function (ctx, text, x, y, color) {

  let textWidth = this.measureText(text);

  ctx.save();

  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      if (ox === 0 && oy === 0) continue;
      this.__renderGlyphs(ctx, text, x + ox, y + oy);
    }
  }

  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "black";
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      if (ox === 0 && oy === 0) continue;
      ctx.fillRect(x + ox, y + this.yOffset, textWidth, this.glyphHeight);
    }
  }
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();

  this.__renderTintedGlyphs(ctx, text, x, y, color || "white");

}

BitmapFont.prototype.__renderTintedGlyphs = function (ctx, text, x, y, color) {

  let tw = this.measureText(text);
  let th = this.glyphHeight;

  let tempCanvas = document.createElement("canvas");
  tempCanvas.width = tw;
  tempCanvas.height = th;
  let tempCtx = tempCanvas.getContext("2d");

  this.__renderGlyphs(tempCtx, text, 0, 0);

  let colorTest = document.createElement("canvas");
  colorTest.width = 1;
  colorTest.height = 1;
  let colorCtx = colorTest.getContext("2d");
  colorCtx.fillStyle = color;
  colorCtx.fillRect(0, 0, 1, 1);
  let cd = colorCtx.getImageData(0, 0, 1, 1).data;

  let imageData = tempCtx.getImageData(0, 0, tw, th);
  let data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 0) {
      data[i] = cd[0];
      data[i + 1] = cd[1];
      data[i + 2] = cd[2];
    }
  }
  tempCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tempCanvas, x, y + this.yOffset);

}

BitmapFont.prototype.__renderGlyphs = function (ctx, text, x, y) {

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);

    if (code === 32) {
      x += this.spaceWidth + this.spacingX;
      continue;
    }

    let index = code - this.firstChar;
    let row = Math.floor(index / this.cols);
    let col = index % this.cols;

    if (row < 0 || row >= this.rows) continue;

    let charWidth = this.charWidths[code] || this.glyphWidth;

    ctx.drawImage(
      this.image,
      col * this.glyphWidth, row * this.glyphHeight, this.glyphWidth, this.glyphHeight,
      x, y + this.yOffset, this.glyphWidth, this.glyphHeight
    );

    x += charWidth + this.spacingX;
  }

}

BitmapFont.prototype.measureText = function (text) {

  let width = 0;

  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code === 32) {
      width += this.spaceWidth + this.spacingX;
    } else {
      width += (this.charWidths[code] || this.glyphWidth) + this.spacingX;
    }
  }

  return width;

}

BitmapFont.prototype.getGlyphHeight = function () {

  return this.glyphHeight;

}
