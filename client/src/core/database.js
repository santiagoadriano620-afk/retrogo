"use strict";

const Database = function () {

  /*
   * Class Database
   * Wrapper around indexedDB for storing minimap information and game files
   */

  // State variable to keep the database
  this.__database = null;

  // Pending cache check flag (set when DB isn't ready yet)
  this.__pendingCacheCheck = false;

  // Guard to prevent double-loading .spr/.dat
  this.__assetsLoading = false;

  // Parameters for minimap storage
  this.__minimapChunkSize = 128;
  this.__loadedMinimapChunks = new Object();

  this.init();

}

Database.prototype.init = function () {
  const VERSION = 1;
  let openRequest = indexedDB.open("game", VERSION);

  openRequest.onerror = this.__handleOpenError.bind(this);
  openRequest.onsuccess = this.__handleOpenSuccess.bind(this);
  openRequest.onupgradeneeded = this.__handleUpgrade.bind(this);
}

Database.prototype.clear = function () {

  /*
   * Function Database.clear
   * Drops the game database completely
   */

  // Ask for confirmation
  if (!confirm("Are you sure you want to reset the client?")) {
    return;
  }

  // Clear localstorage and the indexDB
  localStorage.clear();
  indexedDB.deleteDatabase("game");

  // Reload
  window.location.reload();

}

Database.prototype.transaction = function (store, mode) {

  /*
   * Function Database.transaction
   * Transaction wrapper for the IndexDB
   */

  return this.__database.transaction(store, mode).objectStore(store);

}

Database.prototype.saveChunks = function () {

  /*
   * Function Database.saveChunks
   * Saves all active chunks to the IndexedDB without removing from memory
   */

  let ids = Object.keys(this.__loadedMinimapChunks);
  if (ids.length === 0 || !this.__database) return;

  let store = this.transaction("minimap", "readwrite");
  ids.forEach(function (id) {
    store.put({
      "chunk": id,
      "data": this.__loadedMinimapChunks[id].imageData
    });
  }, this);

}

Database.prototype.persistChunk = function (id) {

  /*
   * Function Database.persistChunk
   * Saves a single minimap chunk to IndexedDB without removing from memory
   */

  if (!this.__loadedMinimapChunks.hasOwnProperty(id) || !this.__database) return;

  let store = this.transaction("minimap", "readwrite");
  store.put({
    "chunk": id,
    "data": this.__loadedMinimapChunks[id].imageData
  });

}

Database.prototype.preloadCallback = function (positions, callback) {

  /*
   * Function Database.preloadCallback
   * Function to preload minimap chunks and fire a callback when all chunked are loaded to memory
   */

  // Only pick the valid minimap chunk positions
  positions = positions.filter(this.isValidMinimapChunk);

  // Following code sort of implements Promise.all
  let count = 0;

  // Collect all callbacks and when all have been completed
  let finishCallback = function () {
    if (++count === positions.length) {
      return callback(this.getLoadedMinimapChunks());
    }
  }.bind(this);

  // Go over each position
  positions.forEach(function (position) {
    this.loadChunk(this.getChunkIdentifier(position), finishCallback);
  }, this);

}

Database.prototype.isValidMinimapChunk = function (position) {

  /*
   * Function Database.isValidMinimapChunk
   * Returns the chunk identifier by concatenation of x, y, z
   */

  return position.x >= 0 && position.y >= 0 && position.z >= 0;

}

Database.prototype.getChunkIdentifier = function (position) {

  /*
   * Function Database.getChunkIdentifier
   * Returns the chunk identifier by concatenation of x, y, z
   */

  // Divide by the chunk size
  let xChunk = Math.floor(position.x / this.__minimapChunkSize);
  let yChunk = Math.floor(position.y / this.__minimapChunkSize);

  // The z-coordinate is single
  return xChunk + "." + yChunk + "." + position.z;

}

Database.prototype.getLoadedMinimapChunks = function () {

  /*
   * Function Database.getLoadedMinimapChunks
   * Returns the loaded minimap chunks that exist in memory
   */

  return this.__loadedMinimapChunks;

}

Database.prototype.loadChunk = function (id, callback) {

  /*
   * Function Database.loadChunk
   * Loads minimap chunk with a particular identifier to memory
   */

  // Already loaded: immediately return by calling the callback
  if (this.__loadedMinimapChunks.hasOwnProperty(id)) {
    return callback();
  }

  this.transaction("minimap", "readonly").get(id).onsuccess = function (event) {

    // Does not have this chunk in the database yet: create a new one
    if (event.target.result === undefined) {
      this.__loadedMinimapChunks[id] = this.__createView(this.__createChunk());
    } else {
      this.__loadedMinimapChunks[id] = this.__createView(event.target.result.data);
    }

    // In-memory is ready!
    callback();

  }.bind(this);

}

Database.prototype.storeFile = function (filename, data) {

  /*

   * Function Database.storeFile
   * Caches a file to IndexedDB and writes a notification to localStorage for quick loading
   */

  if (!this.__database) {
    return;
  }

  let store = this.transaction("files", "readwrite");
  store.put({ "filename": filename, "data": data });
  localStorage.setItem(filename, "true");

}

Database.prototype.loadConstants = async function () {

  // Add cache-busting timestamp to prevent browser caching
  let cacheBuster = Date.now();
  let url = "/things/constants.json?v=%s".format(cacheBuster);
  let response = await fetch(url);
  return await response.json();

}

Database.prototype.getFile = function (filename, callback) {

  if (!this.__database) {
    callback(null);
    return;
  }

  let request = this.transaction("files", "readonly").get(filename);

  request.onsuccess = function (event) {
    let result = event.target.result;
    if (result && result.data) {
      callback(result.data);
    } else {
      callback(null);
    }
  };

  request.onerror = function () {
    callback(null);
  };

}

Database.prototype.hasCachedFile = function (filename) {
  return localStorage.getItem(filename) === "true";
}

Database.prototype.loadGameAssets = function () {
  this.loadConstants().then(function (constant) {
    window.CONST = constant;
    if (this.__database) {
      this.__loadFromCacheOrServer();
    } else {
      this.__pendingCacheCheck = true;
    }
  }.bind(this)).catch(function (err) {
    console.error("[DB] Failed to load constants: " + (err && err.message ? err.message : String(err)));
    window.CONST = {};
    if (this.__database) {
      this.__loadFromCacheOrServer();
    } else {
      this.__pendingCacheCheck = true;
    }
  }.bind(this));
}

Database.prototype.__handleUpgrade = function (event) {

  /*
   * Function Database.handleUpgrade
   * Handles upgrading of the database when the version no longer matches
   */

  // Set the database
  this.__database = event.target.result;

  let objectStore = this.__database.createObjectStore("minimap", { keyPath: "chunk" });
  objectStore.createIndex("id", "chunk");
  this.__database.createObjectStore("files", { keyPath: "filename" }).createIndex("id", "filename");

}

Database.prototype.__handleOpenError = function (event) {
  /* database unavailable */
}

Database.prototype.__handleOpenSuccess = function (event) {

  /*
   * Function Database.handleOpenSuccess
   * Wrapper around indexedDB for storing minimap information
   */

  this.__database = event.target.result;

  // If there's a pending cache check and nothing is loading yet, run it now
  if (this.__pendingCacheCheck && !this.__assetsLoading) {
    this.__pendingCacheCheck = false;
    this.__loadFromCacheOrServer();
  }

}

Database.prototype.__checkVersions = function (callback) {
  fetch("/api/spr-version?v=" + Date.now()).then(function (res) {
    if (!res.ok) return callback(null);
    return res.json().then(callback);
  }).catch(function () {
    callback(null);
  });
};

Database.prototype.__clearFileCache = function () {
  localStorage.removeItem("Tibia.spr");
  localStorage.removeItem("Tibia.dat");
  localStorage.removeItem("Tibia.spr.mtime");
  localStorage.removeItem("Tibia.dat.mtime");
  if (this.__database) {
    try {
      let store = this.transaction("files", "readwrite");
      store.delete("Tibia.spr");
      store.delete("Tibia.dat");
    } catch (_) {}
  }
};

Database.prototype.__storeFileVersion = function (versions) {
  if (versions && versions["Tibia.spr"]) {
    localStorage.setItem("Tibia.spr.mtime", String(versions["Tibia.spr"].mtime));
  }
  if (versions && versions["Tibia.dat"]) {
    localStorage.setItem("Tibia.dat.mtime", String(versions["Tibia.dat"].mtime));
  }
};

Database.prototype.__loadFromCacheOrServer = function () {

  /*

   * Function Database.__loadFromCacheOrServer
   * Tries to load .spr/.dat from IndexedDB cache; falls back to server fetch
   */

  if (this.__assetsLoading) {
    return;
  }

  this.__assetsLoading = true;
  this.__pendingCacheCheck = false;

  // Check server versions before using cache
  this.__checkVersions(function (serverVersions) {
    if (serverVersions) {
      let sprMatch = localStorage.getItem("Tibia.spr.mtime") === String(serverVersions["Tibia.spr"]?.mtime);
      let datMatch = localStorage.getItem("Tibia.dat.mtime") === String(serverVersions["Tibia.dat"]?.mtime);
      if (!sprMatch || !datMatch) {
        this.__clearFileCache();
        this.__fetchFromServer();
        return;
      }
    }

    if (this.hasCachedFile("Tibia.spr") && this.hasCachedFile("Tibia.dat")) {
      this.getFile("Tibia.spr", function (sprData) {
        this.getFile("Tibia.dat", function (datData) {
          if (sprData && datData) {
            gameClient.spriteBuffer.load("Tibia.spr", { "target": { "result": sprData } });
            gameClient.dataObjects.load("Tibia.dat", { "target": { "result": datData } });
            this.__assetsLoading = false;
            return;
          }
          this.__fetchFromServer();
        }.bind(this));
      }.bind(this));
    } else {
      this.__fetchFromServer();
    }
  }.bind(this));
}

Database.prototype.__fetchFromServer = function () {

  gameClient.networkManager.loadGameFilesServer(function () {
    this.__assetsLoading = false;
    this.__pendingCacheCheck = false;
    // Store file versions after successful fetch to invalidate cache next time
    this.__checkVersions(function (versions) {
      this.__storeFileVersion(versions);
    }.bind(this));
  }.bind(this));

}

Database.prototype.__createView = function (chunk) {

  /*
   * Function Database.__createView
   * Returns image data and a Uint32Array view of the imagedata
   */

  // The chunk and 32-bit view of the ImageData ready for manipulation
  return new Object({
    "imageData": chunk,
    "view": new Uint32Array(chunk.data.buffer)
  });

}

Database.prototype.__createChunk = function () {

  /*
   * Function Database.__createChunk
   * Creates an empty chunk to be returned
   */

  // 4 bytes per pixel in 2D is equal to the length
  let size = 4 * this.__minimapChunkSize * this.__minimapChunkSize;

  return new ImageData(new Uint8ClampedArray(size), this.__minimapChunkSize, this.__minimapChunkSize);

}

Database.prototype.dropWorldMapChunks = function (position) {

  /*
   * Function Database.dropWorldMapChunks
   * Saves faraway chunks to IndexedDB then drops them from memory
   */

  if (!this.__database) return;

  let [rx, ry, rz] = this.getChunkIdentifier(position).split(".").map(Number);
  let store = this.transaction("minimap", "readwrite");

  Object.keys(this.__loadedMinimapChunks).forEach(function (id) {

    let [x, y, z] = id.split(".").map(Number);

    if (Math.abs(rx - x) > 2 || Math.abs(ry - y) > 2 || rz !== z) {
      store.put({
        "chunk": id,
        "data": this.__loadedMinimapChunks[id].imageData
      });
      delete this.__loadedMinimapChunks[id];
    }

  }, this);

}

Database.prototype.sweepUnusedChunks = function (position) {

  /*
   * Function Database.sweepUnusedChunks
   * Saves chunks on different Z-layers to IndexedDB, then drops faraway chunks from memory
   */

  if (!this.__database) return;

  let [rx, ry, rz] = this.getChunkIdentifier(position).split(".").map(Number);

  let store = this.transaction("minimap", "readwrite");

  Object.keys(this.__loadedMinimapChunks).forEach(function (id) {

    let [x, y, z] = id.split(".").map(Number);

    // Save chunks on different Z-layer before releasing memory
    if (z !== rz) {
      store.put({
        "chunk": id,
        "data": this.__loadedMinimapChunks[id].imageData
      });
    }

    // Drop chunks that are too far or on a different Z-layer
    if (Math.abs(rx - x) > 2 || Math.abs(ry - y) > 2 || rz !== z) {
      delete this.__loadedMinimapChunks[id];
    }

  }, this);

}
