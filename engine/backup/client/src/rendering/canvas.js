const Canvas = function (id, width, height) {

  this.canvas = this.__reference(id);

  this.canvas.width = width;
  this.canvas.height = height;

  if (id === "screen") {
    let gl = this.canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    if (gl) {
      this.isGL = true;
      this.gl = gl;
      this.__initGL();
      return;
    }
  }

  this.context = this.canvas.getContext("2d");
  this.context.imageSmoothingEnabled = false;

}

Canvas.prototype.getPlayerTileOffset = function () {
  var r = gameClient && gameClient.renderer;
  return {
    x: r ? r.playerTileOffsetX : 14,
    y: r ? r.playerTileOffsetY : 7
  };
};

Canvas.prototype.setScale = function (scale) {

  var o = this.getPlayerTileOffset();
  var originX = o.x * 32;
  var originY = o.y * 32;
  this.canvas.style.transformOrigin = "%spx %spx".format(originX, originY);
  this.canvas.style.transform = "scale(%s)".format(scale);

}

Canvas.prototype.renderText = function (text, x, y, color, font) {

  if (this.isGL) {
    this.__glRenderText(text, x, y, color, font);
    return;
  }

  this.context.font = font || "bold 11px 'Verdana', 'Courier New', monospace";
  this.context.textAlign = "left";
  this.context.textBaseline = "alphabetic";

  let width = this.context.measureText(text).width;

  this.context.fillStyle = "black";
  for (let i = -1; i < 2; i++) {
    for (let j = -1; j < 2; j++) {
      this.context.fillText(text, x + i - Math.floor(width / 2), y + j + 2);
    }
  }

  this.context.fillStyle = color;
  this.context.fillText(text, x - Math.floor(width / 2), y + 2);

}

Canvas.prototype.getWorldCoordinates = function (event) {

  let { x, y } = this.getCanvasCoordinates(event);

  let scaling = gameClient.interface.getSpriteScalingVector();
  let position = gameClient.player.getPosition();
  let o = this.getPlayerTileOffset();

  let projectedViewPosition = new Position(
    Math.floor(x / scaling.x + position.x - o.x),
    Math.floor(y / scaling.y + position.y - o.y),
    position.z
  );

  let chunk = gameClient.world.getChunkFromWorldPosition(projectedViewPosition);

  if (chunk === null) {
    return null;
  }

  return chunk.getFirstTileFromTop(projectedViewPosition.projected());

}

Canvas.prototype.getCanvasCoordinates = function (event) {

  let rect = this.canvas.getBoundingClientRect();

  let x = (event.clientX - rect.left);
  let y = (event.clientY - rect.top);

  return { x, y }

}

Canvas.prototype.black = function () {

  if (this.isGL) {
    this.__glSetColor(0, 0, 0, 1);
    this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, 0, 0, this.canvas.width, this.canvas.height);
    this.__glFlushBatch();
    return;
  }

  this.context.fillStyle = "black";
  this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

}

Canvas.prototype.clear = function () {

  if (this.isGL) {
    let gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return;
  }

  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

}

Canvas.prototype.fillRect = function (x, y, w, h, color) {

  if (this.isGL) {
    this.__glSetColor(color.r, color.g, color.b, color.a);
    this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, x, y, w, h);
    return;
  }

  this.context.fillStyle = "rgba(%s,%s,%s,%s)".format(color.r * 255 | 0, color.g * 255 | 0, color.b * 255 | 0, color.a);
  this.context.fillRect(x, y, w, h);

}

Canvas.prototype.applyFilter = function (filter) {

  if (this.isGL) {
    this.__glFlushBatch();
    return;
  }

  this.__setFilter(filter);
  this.context.drawImage(this.canvas, 0, 0);
  this.__setFilter("none");

}

Canvas.prototype.drawOuterCombatRect = function (position, color) {

  if (this.isGL) {
    this.__glDrawRect(32 * position.x + 0.5, 32 * position.y + 0.5, 30, color);
    return;
  }

  this.drawRect(32 * position.x + 0.5, 32 * position.y + 0.5, 30, color);

}

Canvas.prototype.drawInnerCombatRect = function (animation, position) {

  if (this.isGL) {
    this.__glDrawRect(32 * position.x + 2.5, 32 * position.y + 2.5, 26, animation.color);
    return;
  }

  this.drawRect(32 * position.x + 2.5, 32 * position.y + 2.5, 26, animation.color);

}

Canvas.prototype.drawRect = function (x, y, size, color) {

  if (this.isGL) {
    this.__glDrawRect(x, y, size, color);
    return;
  }

  this.context.beginPath();
  this.context.strokeStyle = Interface.prototype.getHexColor(color);
  this.context.lineWidth = 2;
  this.context.rect(x, y, size, size);
  this.context.stroke();

}

Canvas.prototype.drawCharacter = function (creature, position, size, offset) {

  let frames = creature.getCharacterFrames();

  if (frames === null) {
    return;
  }

  if (creature.outfit.isItemLooktype()) {
    let obj = creature.outfit.getDataObject();
    let frameGroup = obj.getFrameGroup(FrameGroup.prototype.NONE);
    if (frameGroup) {
      let index = frameGroup.getSpriteIndex(0, 0, 0, 0, 0, 0, 0);
      let sprite = frameGroup.getSprite(index);
      if (sprite) {
        this.__drawSprite(sprite, position, 0, 0, size);
      }
    }
    return;
  }

  let direction = creature.__lookDirection;
  let xPattern;

  switch (direction) {
    case CONST.DIRECTION.NORTH: xPattern = 0; break;
    case CONST.DIRECTION.EAST: xPattern = 1; break;
    case CONST.DIRECTION.SOUTH: xPattern = 2; break;
    case CONST.DIRECTION.WEST: xPattern = 3; break;
    case CONST.DIRECTION.SOUTH_EAST:
    case CONST.DIRECTION.NORTH_EAST: xPattern = 1; break;
    case CONST.DIRECTION.SOUTH_WEST:
    case CONST.DIRECTION.NORTH_WEST: xPattern = 3; break;
    default: xPattern = direction % 4;
  }

  let zPattern = 0;

  if (frames.characterGroup.width === 1 && frames.characterGroup.height === 1) {
    position = { x: position.x - 0.25, y: position.y - 0.28125 };
  }

  this.__drawCharacter(
    gameClient.getCreatureSpriteBuffer(creature),
    creature.outfit,
    position,
    frames.characterGroup,
    frames.characterFrame,
    xPattern,
    zPattern,
    size,
    offset
  );

}

Canvas.prototype.drawDistanceAnimation = function (animation, position) {

  let fraction = animation.getFraction();

  let renderPosition = {
    x: position.x + fraction * (animation.toPosition.x - animation.fromPosition.x),
    y: position.y + fraction * (animation.toPosition.y - animation.fromPosition.y)
  }

  return this.drawSprite(animation, renderPosition, 32);

}

Canvas.prototype.drawImage = function (image, a1, a2, a3, a4, a5, a6, a7, a8) {

  if (this.isGL) {
    let gl = this.gl;
    let iw = image.width || image.videoWidth || 1;
    let ih = image.height || image.videoHeight || 1;

    let sx, sy, sw, sh, dx, dy, dw, dh;
    if (arguments.length <= 5) {
      sx = 0; sy = 0; sw = iw; sh = ih;
      dx = a1; dy = a2; dw = (a3 !== undefined ? a3 : iw); dh = (a4 !== undefined ? a4 : ih);
    } else {
      sx = a1; sy = a2; sw = a3; sh = a4;
      dx = a5; dy = a6; dw = a7; dh = a8;
    }

    this.__glFlushBatch();

    // Cache canvas textures to avoid re-upload every frame
    if (image instanceof HTMLCanvasElement) {
      let canvasGen = (image.__glTexGen === undefined) ? 0 : image.__glTexGen;
      let cached = this.__glCanvasTexCache.get(image);
      if (cached && cached.w === iw && cached.h === ih && cached.gen === canvasGen) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, cached.tex);
        this.__glActiveCanvas = image;
        this.__glActiveImageW = iw;
        this.__glActiveImageH = ih;
        this.__glSetColor(1, 1, 1, 1);
        this.__glQuad(image, sx, sy, sw, sh, dx, dy, dw, dh);
        return;
      }
      let tex = cached ? cached.tex : gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.__glCanvasTexCache.set(image, { tex: tex, w: iw, h: ih, gen: canvasGen });
      this.__glTexUploads++;
      this.__glTexGen = canvasGen;
    }

    this.__glActiveImageW = iw;
    this.__glActiveImageH = ih;

    this.__glSetColor(1, 1, 1, 1);
    this.__glQuad(image, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }

  if (arguments.length <= 5) {
    if (a3 !== undefined) {
      this.context.drawImage(image, a1, a2, a3, a4);
    } else {
      this.context.drawImage(image, a1, a2);
    }
  } else {
    this.context.drawImage(image, a1, a2, a3, a4, a5, a6, a7, a8);
  }

}

Canvas.prototype.drawSprite = function (thing, position, size, offsetX, offsetY) {

  offsetX = offsetX || 0;
  offsetY = offsetY || 0;

  let frameGroup = thing.getFrameGroup(FrameGroup.prototype.NONE);
  if (!frameGroup) {
    this.__drawFallbackSprite(thing, position, offsetX, offsetY);
    return;
  }
  let frame = thing.getFrame();
  let pattern = thing.getPattern();

  let w = frameGroup.width;
  let h = frameGroup.height;

  if (w === 1 && h === 1 && frameGroup.layers === 1) {
    let index = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
    let sprite = frameGroup.getSprite(index);
    if (!sprite) return;
    this.__drawSprite(sprite, position, 0, 0, size, offsetX, offsetY);
    return;
  }

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      for (let l = 0; l < frameGroup.layers; l++) {
        let index = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, l, x, y);
        let sprite = frameGroup.getSprite(index);
        if (!sprite) continue;
        this.__drawSprite(sprite, position, x, y, size, offsetX, offsetY);
      }
    }
  }

}

Canvas.prototype.__drawFallbackSprite = function (thing, position, offsetX, offsetY) {
  if (!this.__fallbackImages) {
    this.__fallbackImages = {};
  }
  var img = this.__fallbackImages[thing.id];
  if (!img) {
    img = new Image();
    if (thing.id === 3138) {
      img.src = "images/game/console/trainingdummy.png";
    }
    this.__fallbackImages[thing.id] = img;
  }
  if (!img.src || !img.complete) return;
  var px = (32 * position.x + 0.5 + offsetX) | 0;
  var py = (32 * position.y + 0.5 + offsetY) | 0;
  if (this.isGL) {
    this.__glQuad(img, 0, 0, 32, 32, px, py, 32, 32);
  } else {
    this.context.drawImage(img, 0, 0, 32, 32, px, py, 32, 32);
  }
};

Canvas.prototype.drawSpriteOverlay = function (thing, position, size) {

  let frameGroup = thing.getFrameGroup(FrameGroup.prototype.GROUP_IDLE);
  let frame = thing.getFrame();
  let pattern = thing.getPattern();

  for (let x = 0; x < frameGroup.width; x++) {
    for (let y = 0; y < frameGroup.height; y++) {
      for (let l = 0; l < frameGroup.layers; l++) {
        let index = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, l, x, y);

        gameClient.renderer.outlineCanvas.createOutline(frameGroup.sprites[index]);

        if (this.isGL) {
          this.drawImage(
            gameClient.renderer.outlineCanvas.canvas,
            position.x * 32 - 1,
            position.y * 32 - 1,
            33, 33
          );
        } else {
          this.context.drawImage(
            gameClient.renderer.outlineCanvas.canvas,
            0, 0, 33, 33,
            position.x * 32 - 1,
            position.y * 32 - 1,
            33, 33
          );
        }
      }
    }
  }

}

Canvas.prototype.setGlobalAlpha = function (alpha) {

  if (this.isGL) {
    if (alpha !== this.__glGlobalAlpha) {
      this.__glGlobalAlpha = alpha;
      this.__glColorDirty = true;
    }
    return;
  }

  this.context.globalAlpha = alpha;

}

Canvas.prototype.setImageSmoothing = function (enabled) {

  if (this.isGL) {
    return;
  }

  this.context.imageSmoothingEnabled = enabled;

}

Canvas.prototype.flush = function () {

  if (this.isGL) {
    this.__glFlushBatch();
  }

}

Canvas.prototype.toDataURL = function (type, quality) {

  if (this.isGL) {
    let gl = this.gl;
    let w = this.canvas.width;
    let h = this.canvas.height;
    this.__glFlushBatch();
    let pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    let ctx = canvas.getContext("2d");
    let imageData = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let si = (y * w + x) * 4;
        let di = ((h - 1 - y) * w + x) * 4;
        imageData.data[di] = pixels[si];
        imageData.data[di + 1] = pixels[si + 1];
        imageData.data[di + 2] = pixels[si + 2];
        imageData.data[di + 3] = pixels[si + 3];
      }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL(type, quality);
  }

  return this.canvas.toDataURL(type, quality);

}

Canvas.prototype.resetStats = function () {

  this.__glFlushCount = 0;
  this.__glBatchQuads = 0;
  this.__glTexUploads = 0;

}

Canvas.prototype.__setFilter = function (filter) {

  if (this.isGL) {
    return;
  }

  switch (filter) {
    case "matrix": return this.context.filter = "url(#matrix)";
    case "greyscale": return this.context.filter = "grayscale()";
    case "hue": return this.context.filter = "hue-rotate(" + (gameClient.getFrame() % 360) + "deg)";
    case "invert": return this.context.filter = "invert()";
    case "sepia": return this.context.filter = "sepia()";
    case "blur": return this.context.filter = "blur(4px)";
    case "saturate": return this.context.filter = "saturate(20%)";
    case "none": return this.context.filter = "none";
  }

}

Canvas.prototype.__drawSprite = function (sprite, position, x, y, size, offsetX, offsetY) {

  offsetX = offsetX || 0;
  offsetY = offsetY || 0;

  if (sprite === null) {
    return;
  }

  if (this.isGL) {
    this.__glQuad(
      sprite.src,
      32 * sprite.position.x,
      32 * sprite.position.y,
      32, 32,
      (32 * (position.x - x) + 0.5 + offsetX) | 0,
      (32 * (position.y - y) + 0.5 + offsetY) | 0,
      32, 32
    );
    return;
  }

  this.context.drawImage(
    sprite.src,
    32 * sprite.position.x,
    32 * sprite.position.y,
    32, 32,
    (32 * (position.x - x) + 0.5 + offsetX) | 0,
    (32 * (position.y - y) + 0.5 + offsetY) | 0,
    32, 32
  );

}

Canvas.prototype.__drawCharacter = function (spriteBuffer, outfit, position, characterGroup, characterFrame, xPattern, zPattern, size, offset) {

  if (characterGroup.width > 1 || characterGroup.height > 1) {
    position = { x: position.x - offset, y: position.y - offset };
  }

  for (let x = 0; x < characterGroup.width; x++) {
    for (let y = 0; y < characterGroup.height; y++) {

      let baseIdentifier = characterGroup.getSpriteId(characterFrame, xPattern, 0, zPattern, 0, x, y);

      if (!outfit.hasLookDetails()) {
        this.__drawSprite(spriteBuffer.get(baseIdentifier), position, x, y, size);
        continue;
      }

      if (baseIdentifier === 0 && outfit.addonOne) {
        baseIdentifier = characterGroup.getSpriteId(characterFrame, xPattern, 1, zPattern, 0, x, y);
      }

      if (baseIdentifier === 0 && outfit.addonTwo) {
        baseIdentifier = characterGroup.getSpriteId(characterFrame, xPattern, 2, zPattern, 0, x, y);
      }

      if (baseIdentifier === 0) continue;

      if (!spriteBuffer.has(baseIdentifier)) {
        spriteBuffer.addComposedOutfit(baseIdentifier, outfit, characterGroup, characterFrame, xPattern, zPattern, x, y);
      }

      this.__drawSprite(spriteBuffer.get(baseIdentifier), position, x, y, size);

    }
  }

}

Canvas.prototype.__glDrawRect = function (x, y, size, color) {

  let c = Interface.prototype.getHexColor(color);
  let r = parseInt(c.slice(1, 3), 16) / 255;
  let g = parseInt(c.slice(3, 5), 16) / 255;
  let b = parseInt(c.slice(5, 7), 16) / 255;

  this.__glSetColor(r, g, b, 1);
  let lw = 2;

  this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, x, y, size, lw);
  this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, x, y + size - lw, size, lw);
  this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, x, y, lw, size);
  this.__glQuad(this.__glWhiteTexture, 0, 0, 1, 1, x + size - lw, y, lw, size);

}

Canvas.prototype.__glRenderText = function (text, x, y, color, font) {

  let ctx = this.__textCtx;
  let fontStr = font || "bold 11px 'Verdana', 'Courier New', monospace";
  ctx.font = fontStr;

  let width = ctx.measureText(text).width;
  let tw = Math.max(1, Math.ceil(width + 4));
  let th = 32;

  if (this.__textCanvas.width < tw) {
    this.__textCanvas.width = tw;
  }
  if (this.__textCanvas.height < th) {
    this.__textCanvas.height = th;
  }

  ctx.clearRect(0, 0, tw, th);
  ctx.font = fontStr;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let cx = 2;
  let cy = 12;

  ctx.fillStyle = "black";
  ctx.fillText(text, cx, cy);

  let c = Interface.prototype.getHexColor(color);
  ctx.fillStyle = c;
  ctx.fillText(text, cx, cy);

  this.__textCanvas.__glTexGen = (this.__textCanvas.__glTexGen || 0) + 1;
  this.__glSetColor(1, 1, 1, 1);

  this.__glQuad(this.__textCanvas, 0, 0, tw, th,
    x - Math.floor(width / 2),
    y + 2,
    tw, th);

}

Canvas.prototype.__glSetColor = function (r, g, b, a) {

  if (this.__glColor[0] !== r || this.__glColor[1] !== g ||
      this.__glColor[2] !== b || this.__glColor[3] !== a) {
    this.__glFlushBatch();
    this.__glColor[0] = r;
    this.__glColor[1] = g;
    this.__glColor[2] = b;
    this.__glColor[3] = a;
    this.__glColorDirty = true;
  }

}

Canvas.prototype.__glQuad = function (srcCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH) {

  if (this.__glQuadCount >= this.__glMaxQuads) {
    return;
  }

  let canvasGen = (srcCanvas.__glTexGen === undefined) ? 0 : srcCanvas.__glTexGen;

  if (this.__glActiveCanvas !== srcCanvas || canvasGen !== this.__glTexGen) {
    let gl = this.gl;
    let needUpload = (this.__glActiveCanvas !== srcCanvas);
    this.__glFlushBatch();
    this.__glActiveCanvas = srcCanvas;

    if (srcCanvas === this.__glWhiteTexture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.__glWhiteTexture);
      this.__glActiveImageW = 1;
      this.__glActiveImageH = 1;
      this.__glTexGen = canvasGen;
    } else {
      let cached = this.__glCanvasTexCache.get(srcCanvas);
      if (cached && cached.w === (srcCanvas.width || srcCanvas.videoWidth || 1)
              && cached.h === (srcCanvas.height || srcCanvas.videoHeight || 1)
              && cached.gen === canvasGen) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, cached.tex);
        this.__glActiveImageW = cached.w;
        this.__glActiveImageH = cached.h;
      } else {
        let tex = cached ? cached.tex : gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
        let linear = srcCanvas.__glFilterLinear;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.__glCanvasTexCache.set(srcCanvas, {
          tex: tex,
          w: srcCanvas.width || srcCanvas.videoWidth || 1,
          h: srcCanvas.height || srcCanvas.videoHeight || 1,
          gen: canvasGen
        });
        this.__glTexUploads++;
        this.__glActiveImageW = srcCanvas.width || srcCanvas.videoWidth || 1;
        this.__glActiveImageH = srcCanvas.height || srcCanvas.videoHeight || 1;
      }
      this.__glTexGen = canvasGen;
    }

  }

  let iw = this.__glActiveImageW;
  let ih = this.__glActiveImageH;

  let u0 = srcX / iw;
  let v0 = 1 - srcY / ih;
  let u1 = (srcX + srcW) / iw;
  let v1 = 1 - (srcY + srcH) / ih;

  let x0 = dstX;
  let y0 = dstY;
  let x1 = dstX + dstW;
  let y1 = dstY + dstH;

  let base = this.__glQuadCount * 16;
  let vb = this.__glVertexBuffer;

  vb[base + 0] = x0;  vb[base + 1] = y0;  vb[base + 2] = u0;  vb[base + 3] = v0;
  vb[base + 4] = x1;  vb[base + 5] = y0;  vb[base + 6] = u1;  vb[base + 7] = v0;
  vb[base + 8] = x1;  vb[base + 9] = y1;  vb[base + 10] = u1; vb[base + 11] = v1;
  vb[base + 12] = x0; vb[base + 13] = y1; vb[base + 14] = u0; vb[base + 15] = v1;

  this.__glQuadCount++;

}

Canvas.prototype.__glFlushBatch = function () {

  let gl = this.gl;
  if (!gl || this.__glQuadCount === 0) {
    return;
  }

  gl.useProgram(this.__glProgram);

  if (this.__glColorDirty) {
    gl.uniform4fv(this.__glColorLoc, this.__glColor);
    this.__glColorDirty = false;
  }

  if (this.__glGlobalAlpha < 1) {
    gl.uniform4f(this.__glColorLoc,
      this.__glColor[0] * this.__glGlobalAlpha,
      this.__glColor[1] * this.__glGlobalAlpha,
      this.__glColor[2] * this.__glGlobalAlpha,
      this.__glColor[3] * this.__glGlobalAlpha
    );
  }

  gl.uniform2f(this.__glResLoc, this.canvas.width, this.canvas.height);

  gl.bindVertexArray(this.__glVao);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.__glVertexBuffer.subarray(0, this.__glQuadCount * 16));

  let indexCount = this.__glQuadCount * 6;
  gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);

  gl.bindVertexArray(null);

  this.__glFlushCount++;
  this.__glBatchQuads += this.__glQuadCount;
  if (typeof gameClient !== "undefined" && gameClient.renderer) {
    gameClient.renderer.drawCalls++;
  }
  this.__glQuadCount = 0;

}

Canvas.prototype.__initGL = function () {

  let gl = this.gl;

  this.__glMaxQuads = 16384;
  this.__glQuadCount = 0;
  this.__glActiveCanvas = null;
  this.__glActiveImageW = 1;
  this.__glActiveImageH = 1;
  this.__glGlobalAlpha = 1;
  this.__glFlushCount = 0;
  this.__glBatchQuads = 0;
  this.__glTexUploads = 0;
  this.__glTexGen = 0;

  this.__glColor = new Float32Array([1, 1, 1, 1]);
  this.__glColorDirty = true;

  let vs = "#version 300 es\nprecision highp float;\nlayout(location=0)in vec2 aPosition;\nlayout(location=1)in vec2 aTexCoord;\nout vec2 vTexCoord;\nuniform vec2 uResolution;\nvoid main(){vec2 c=aPosition/uResolution*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);vTexCoord=aTexCoord;}";

  let fs = "#version 300 es\nprecision highp float;\nin vec2 vTexCoord;\nuniform sampler2D uTexture;\nuniform vec4 uColor;\nout vec4 fragColor;\nvoid main(){vec4 t=texture(uTexture,vTexCoord);fragColor=vec4(t.rgb*uColor.rgb,t.a*uColor.a);if(fragColor.a<0.004)discard;}";

  this.__glProgram = this.__glCreateProgram(vs, fs);

  this.__glResLoc = gl.getUniformLocation(this.__glProgram, "uResolution");
  this.__glColorLoc = gl.getUniformLocation(this.__glProgram, "uColor");

  let uTexLoc = gl.getUniformLocation(this.__glProgram, "uTexture");
  gl.useProgram(this.__glProgram);
  gl.uniform1i(uTexLoc, 0);
  gl.useProgram(null);

  let floatsPerVert = 4;
  let vertexStride = floatsPerVert * 4;
  let floatsPerQuad = floatsPerVert * 4;
  let vertexData = new Float32Array(this.__glMaxQuads * floatsPerQuad);

  let indexData = new Uint16Array(this.__glMaxQuads * 6);
  for (let i = 0; i < this.__glMaxQuads; i++) {
    let base = i * 6;
    let vert = i * 4;
    indexData[base + 0] = vert + 0;
    indexData[base + 1] = vert + 1;
    indexData[base + 2] = vert + 2;
    indexData[base + 3] = vert + 0;
    indexData[base + 4] = vert + 2;
    indexData[base + 5] = vert + 3;
  }

  this.__glVertexBuffer = vertexData;

  this.__glVao = gl.createVertexArray();
  gl.bindVertexArray(this.__glVao);

  this.__glVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, this.__glVbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);

  this.__glIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.__glIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, vertexStride, 0);

  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, vertexStride, 2 * 4);

  gl.bindVertexArray(null);

  this.__glTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.__glTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.__glWhiteTexture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.__glWhiteTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindTexture(gl.TEXTURE_2D, null);

  this.__glCanvasTexCache = new WeakMap();

  this.__textCanvas = document.createElement("canvas");
  this.__textCtx = this.__textCanvas.getContext("2d");

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);

  this.__glActiveCanvas = null;

}

Canvas.prototype.__glCreateProgram = function (vertexSrc, fragmentSrc) {

  let gl = this.gl;

  let vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertexSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("[GL] Vertex shader error:", gl.getShaderInfoLog(vs));
    gl.deleteShader(vs);
    return null;
  }

  let fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragmentSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("[GL] Fragment shader error:", gl.getShaderInfoLog(fs));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  let program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[GL] Program link error:", gl.getProgramInfoLog(program));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.deleteProgram(program);
    return null;
  }

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  return program;

}

Canvas.prototype.__reference = function (id) {

  if (id === null) {
    return document.createElement("canvas");
  }

  if (typeof id === "string") {
    return document.getElementById(id);
  }

  return id;

}
