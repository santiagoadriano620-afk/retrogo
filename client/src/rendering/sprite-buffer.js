const SpriteBuffer = function(size) {

  /*
   * Class SpriteBuffer
   * Abstracted container for the sprite buffer that buffers sprite from Tibia.spr
   * ready to be drawn to the canvas.
   * 
   * Public API:
   *
   *  @ SpriteBuffer.get(id) - Returns (from cache) the sprite for a particular sprite identifier
   *  @ SpriteBuffer.load(event) - Callback fired when the sprite file is selected
   *  @ SpriteBuffer.clear() - Clears the sprite buffer and resets all state
   *  @ SpriteBuffer.reserve(id) - Reserves a slot with a particular identifier on the sprite buffer and returns the position on the buffer
   *  @ SpriteBuffer.addComposed(position, outfit, base, mask) - Adds a sprite to a position on the sprite buffer
   *
   *  @ nEvictions - Returns the total number of evictions from the sprite buffer
   *  @ size - Returns the size of the sprite buffer
   *  @ SIGNATURES - Object that stored references from sprite files signatures to client versions
   *
   */

  this.size = size;

  // State variables
  this.__spriteBufferIndex = 0;
  this.__spriteBufferArray = new Array(size * size).fill(null);
  this.__spriteBufferLookup = new Object();

  // Create the actual sprite buffer canvas: sprites are rendered to this canvas before being copied over to the game screen
  this.__spriteBufferCanvas = new Canvas(null, 32 * size, 32 * size);

  this.nEvictions = 0;

  // Temporary canvas to compose entity outfits
  this.compositionCanvas = new Canvas(null, 32, 32);
  this.__version = null;

}

SpriteBuffer.prototype.SIGNATURES = new Object({
  "41B9EA86": 740,
  "467F9E74": 800,
  "57BBD603": 1098
});

SpriteBuffer.prototype.__spriteAddressPointers = new Object();

SpriteBuffer.prototype.getVersion = function() {

  return this.__version;

}

SpriteBuffer.prototype.addComposedOutfitLayer = function(id, outfit, item, frame, xPattern, yPattern, zPattern, x, y) {

  /*
   * Function SpriteBuffer.addComposedOutfitLayer
   * Adds another layer to the composited sprite
   */

  // Base sprite and mask
  let groundSprite = item.getSpriteId(frame, xPattern, yPattern, zPattern, 0, x, y);
  let maskSprite = item.getSpriteId(frame, xPattern, yPattern, zPattern, 1, x, y);

  // Add to the existing identifier
  this.addComposed(id, outfit, groundSprite, maskSprite);

}

SpriteBuffer.prototype.getSpritePosition = function(id) {

  /*
   * Function SpriteBuffer.getSpritePosition
   * Gets the sprite position on the sprite buffer
   */

  if(!this.has(id)) {
    return null;
  }

  return this.__getPosition(this.__spriteBufferLookup[id]);

}

SpriteBuffer.prototype.addComposedOutfit = function(baseIdentifier, outfit, item, frame, xPattern, zPattern, x, y) {

  /*
   * Function SpriteBuffer.addComposedOutfit
   * Adds an outfit to the sprite buffer
   */

  // Reserve a spot for the identifier in the buffer
  // All images are written and composed to this identifier
  let position = this.reserve(baseIdentifier);
  
  // Add the first outfit layer
  this.addComposedOutfitLayer(position, outfit, item, frame, xPattern, 0, zPattern, x, y);
  
  // First addon if enabled and available
  if(outfit.addonOne && item.pattern.y > 1) {
    this.addComposedOutfitLayer(position, outfit, item, frame, xPattern, 1, zPattern, x, y);
  }
  
  // Second addon if enabled and available
  if(outfit.addonTwo && item.pattern.y > 2) {
    this.addComposedOutfitLayer(position, outfit, item, frame, xPattern, 2, zPattern, x, y);
  }

}

SpriteBuffer.prototype.clear = function() {

  /*
   * Function SpriteBuffer.clear
   * Fully clears the sprite buffer and resets all state
   */

  this.__spriteBufferIndex = 0;
  this.__spriteBufferArray = this.__spriteBufferArray.fill(null);
  this.__spriteBufferLookup = new Object();

  // Empty the canvas
  this.__spriteBufferCanvas.clear();

  // Invalidate WebGL texture cache
  let cv = this.__spriteBufferCanvas.canvas;
  cv.__glTexGen = (cv.__glTexGen || 0) + 1;

}

SpriteBuffer.prototype.has = function(id) {

  /*
   * Function SpriteBuffer.has
   * Returns true or false whether the spritebuffer has the current sprite cached
   */

  return this.__spriteBufferLookup.hasOwnProperty(id);

}

SpriteBuffer.prototype.reserve = function(id) {

  /*
   * Function SpriteBuffer.reserve
   * Reserves a slot for an identifier
   */

  // Evict another sprite if necessary
  this.__evict(this.__spriteBufferIndex);

  this.__spriteBufferArray[this.__spriteBufferIndex] = id;
  this.__spriteBufferLookup[id] = this.__spriteBufferIndex;

  // Clear the position to be reserved
  let position = this.__getPosition(this.__spriteBufferIndex);

  this.__spriteBufferIndex++;
  this.__spriteBufferIndex = this.__spriteBufferIndex % this.__spriteBufferArray.length;

  return position;

}

SpriteBuffer.prototype.get = function(id) {

  if(id === 0) {
    return null;
  }

  if(!this.has(id)) {
    return this.__add(id);
  }

  return this.__get(id);

}

SpriteBuffer.prototype.addComposed = function(position, outfit, base, mask) {

  /*
   * Function SpriteBuffer.addComposed
   * Adds a composed image to the temporary buffer and writes draws it to the sprite buffer
   */

  // Nothing to do
  if(base === 0) {
    return;
  }

  // Get the base
  let baseData = this.__getImageData(base);

  // If a mask is supplied compose the two sprites to a real outfit
  if(mask !== 0) {
    this.__compose(outfit, baseData, this.__getImageData(mask));
  }

  // Put the current sprite to the temporary canvas
  this.compositionCanvas.context.putImageData(baseData, 0, 0);

  // Draw the temporary canvas to the sprite buffer
  this.__spriteBufferCanvas.context.drawImage(
    this.compositionCanvas.canvas,
    32 * position.x,
    32 * position.y
  );

  // Mark canvas content as changed for WebGL texture cache invalidation
  let cv = this.__spriteBufferCanvas.canvas;
  cv.__glTexGen = (cv.__glTexGen || 0) + 1;

}

SpriteBuffer.prototype.load = function(name, event) {

  /*
   * Function SpriteBuffer.load
   * Loads the Tibia.spr file and parses all sprites to spritesheets
   */

  // Attempt to load
  try {
    this.__load(name, event.target.result);
    try { gameClient.database.storeFile(name, event.target.result); } catch(e) {}
  } catch(exception) {
    var msg = "Sprite error: " + (exception && exception.message ? exception.message : String(exception));
    gameClient.interface.modalManager.open("floater-connecting", exception);
  }

}

SpriteBuffer.prototype.__load = function(name, buffer) {

  /*
   * Function SpriteBuffer.__load
   * Internal function to load the Tibia spr file from disk
   */

  let start = performance.now();

  // Create a readable buffer from the file data
  SpriteBuffer.prototype.packet = new PacketReader(buffer);

  // Get the file signature and sprite count
  let signature = this.packet.readUInt32().toString(16).toUpperCase();

  // Verify the 4 byte data signature
  if(!this.SIGNATURES.hasOwnProperty(signature)) {
    throw("Unknown Tibia.spr file supplied.");
  }

  // Set the version from the signature (on both instance and static for shared access)
  this.__version = this.SIGNATURES[signature];
  SpriteBuffer.__sharedVersion = this.__version;

  // Determine sprite count width: 16-bit or 32-bit depending on version
  let spriteCountWidth = (this.__version >= 960) ? 4 : 2;

  // The total number of sprites is either 16-bit or 32-bit depending on the version
  let spriteCount = (spriteCountWidth === 4) ? this.packet.readUInt32() : this.packet.readUInt16();

  // Guard against corrupted cache data: each sprite reads 4 bytes, check buffer bounds
  var maxSprites = Math.floor((this.packet.buffer.length - this.packet.index) / 4) + 1;
  if (spriteCount > maxSprites) {
    throw new Error("Corrupted Tibia.spr: spriteCount=" + spriteCount + " exceeds available data (" + maxSprites + " max)");
  }

  // Go over each sprite
  for(let i = 1; i < spriteCount; i++) {

    // Read the sprite address (32-bit)
    let address = this.packet.readUInt32();

    // NULL address: continue
    if(address === 0) {
      continue;
    }

    // Reference the address in the spritesheet lookup. When the sprite is requested it is loaded from this pointer address
    this.__spriteAddressPointers[i] = address;

  }

  gameClient.interface.loadAssetCallback("sprite", name);

}

SpriteBuffer.prototype.__add = function(id) {

  /*
   * Function spriteBuffer.__add
   * Adds a sprite to the spritebuffer
   */

  // Reserve a slot in the sprite buffer
  let position = this.reserve(id);

  // Fetch the address of the sprite and get the RGBA color data
  let imageData = this.__getImageData(id);

  // Add the unpacked sprite to the sprite buffer
  this.__spriteBufferCanvas.context.putImageData(imageData, 32 * position.x, 32 * position.y);

  // Mark canvas content as changed for WebGL texture cache invalidation
  let cv = this.__spriteBufferCanvas.canvas;
  cv.__glTexGen = (cv.__glTexGen || 0) + 1;

  // Return it!
  return new Sprite(this.__spriteBufferCanvas.canvas, position, 32);

}

SpriteBuffer.prototype.__compose = function(outfit, baseData, maskData) {

  /*
   * Function SpriteBuffer.__compose
   * Composes a look detail sprite from base and mask data
   */

  let HEAD = outfit.getColor(outfit.details.head);
  let BODY = outfit.getColor(outfit.details.body);
  let LEGS = outfit.getColor(outfit.details.legs);
  let FEET = outfit.getColor(outfit.details.feet);

  // Create 32-bit views (this is usually LE)
  let mask = new Uint32Array(maskData.data.buffer);
  let base = baseData.data;

  // Go over 32-bit sections RGBA
  for(let i = 0; i < mask.length; i++) {
 
    let offset = 4 * i;

    // Multiply the pixels
    switch(mask[i]) {

      case 0xFF00FFFF:
        base[offset + 0] = (base[offset + 0] * ((HEAD >> 0) & 0xFF)) / 0xFF;
        base[offset + 1] = (base[offset + 1] * ((HEAD >> 8) & 0xFF)) / 0xFF;
        base[offset + 2] = (base[offset + 2] * ((HEAD >> 16) & 0xFF)) / 0xFF;
        break;
      case 0xFF0000FF:
        base[offset + 0] = (base[offset + 0] * ((BODY >> 0) & 0xFF)) / 0xFF;
        base[offset + 1] = (base[offset + 1] * ((BODY >> 8) & 0xFF)) / 0xFF;
        base[offset + 2] = (base[offset + 2] * ((BODY >> 16) & 0xFF)) / 0xFF;
        break;
      case 0xFF00FF00:
        base[offset + 0] = (base[offset + 0] * ((LEGS >> 0) & 0xFF)) / 0xFF;
        base[offset + 1] = (base[offset + 1] * ((LEGS >> 8) & 0xFF)) / 0xFF;
        base[offset + 2] = (base[offset + 2] * ((LEGS >> 16) & 0xFF)) / 0xFF;
        break;
      case 0xFFFF0000:
        base[offset + 0] = (base[offset + 0] * ((FEET >> 0) & 0xFF)) / 0xFF;
        base[offset + 1] = (base[offset + 1] * ((FEET >> 8) & 0xFF)) / 0xFF;
        base[offset + 2] = (base[offset + 2] * ((FEET >> 16) & 0xFF)) / 0xFF;
        break;
    }

  }

}

SpriteBuffer.prototype.__get = function(id) {

  /*
   * Function SpriteBuffer.__get
   * Returns the sprite from an available id
   */

  // Fetch the index from the address lookup
  let index = this.__spriteBufferLookup[id];
  let position = this.__getPosition(index);

  // Return the newly added sprite
  return new Sprite(this.__spriteBufferCanvas.canvas, position, 32);

}

SpriteBuffer.prototype.__evict = function(index) {

  /*
   * Function SpriteBuffer.__evict
   * Evicts sprite at the current position
   */

  // The current slot is empty: nothing evict
  if(this.__spriteBufferArray[index] === null) {
    return;
  }

  // Increment the number of evictions
  this.nEvictions++;

  // Delete entry in the hashmap: this sprite is no longer in the sprite buffer
  delete this.__spriteBufferLookup[this.__spriteBufferArray[index]];

}

SpriteBuffer.prototype.__getPosition = function(index) {

  /*
   * Function SpriteBuffer.__getPosition
   * Returns the x, y position (offset) in the sprite buffer for an index
   */

  // Get the coordinates
  let x = (index % this.size) | 0;
  let y = (index / this.size) | 0;

  return new Position(x, y);

}

SpriteBuffer.prototype.__getImageData = function(id) {

  /*
   * Function SpriteBuffer.getImageData
   * Returns the image data from the loaded sprite file
   */

  return this.__loadSingleSprite(this.__spriteAddressPointers[id]);

}

SpriteBuffer.prototype.__loadSingleSprite = function(address) {

  /*
   * Function __loadSingleSprite
   * Loads a single sprite from the full sprite buffer
   */

  // If the address is invalid, return a fully transparent sprite
  if (!address || address + 5 >= this.packet.buffer.length) {
    return new ImageData(new Uint8ClampedArray(32 * 32 * 4), 32, 32);
  }

  // Version >= 800 uses RGBA 4-byte pixels (transparency format)
  let version = this.__version || SpriteBuffer.__sharedVersion || 0;
  let useAlpha = version >= 800;

  // Read ahead to get the sprite data size (at bytes [3,4] regardless of format)
  let spriteLength = this.packet.buffer[address + 3] + (this.packet.buffer[address + 4] << 8);

  // Cut off the right slice counting from the address
  let spritePacket = this.packet.slice(address, address + 5 + spriteLength);

  // Skip the 3-byte color key and the 2-byte size header
  spritePacket.skip(5);

  // Allocate a buffer for 32x32 image reconstruction (RGBA bytes, direct)
  let buffer = new Uint8ClampedArray(32 * 32 * 4);
  let index = 0;

  // Go over the sprite packet itself
  while(spritePacket.readable()) {

    // Read the number of transparent pixels and colored pixels
    let transparentPixels = spritePacket.readUInt16();
    let coloredPixels = spritePacket.readUInt16();

    // Skip all the transparent pixels
    index += transparentPixels;

    // Copy over the pixel values
    for(let i = index; i < index + coloredPixels; i++) {
      let pixelIndex = i * 4;
      if (useAlpha) {
        // RGBA 4-byte pixel: file bytes are [R, G, B, A]
        let r = spritePacket.readUInt8();
        let g = spritePacket.readUInt8();
        let b = spritePacket.readUInt8();
        let a = spritePacket.readUInt8();
        buffer[pixelIndex + 0] = r;
        buffer[pixelIndex + 1] = g;
        buffer[pixelIndex + 2] = b;
        buffer[pixelIndex + 3] = a;
      } else {
        // RGB 3-byte pixel: full opacity
        let r = spritePacket.readUInt8();
        let g = spritePacket.readUInt8();
        let b = spritePacket.readUInt8();
        buffer[pixelIndex + 0] = r;
        buffer[pixelIndex + 1] = g;
        buffer[pixelIndex + 2] = b;
        buffer[pixelIndex + 3] = 0xFF;
      }
    }

    index += coloredPixels;

  }

  // Create the image data
  return new ImageData(buffer, 32, 32);

}
