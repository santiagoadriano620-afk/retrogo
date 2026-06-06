const HotkeyModal = function(id) {
  Modal.call(this, id);
  this.__selectedIndex = -1;
  this.__captureCallback = null;
  this.__data = null;
  this.__addEventListeners();
}

HotkeyModal.prototype = Object.create(Modal.prototype);
HotkeyModal.constructor = HotkeyModal;

HotkeyModal.prototype.handleOpen = function() {
  this.__loadData();
  this.__renderConfigSelector();
  this.__selectConfig(this.__data.activeConfig);
}

HotkeyModal.prototype.handleConfirm = function() {
  this.__saveData();
  return true;
}

HotkeyModal.prototype.__loadData = function() {
  let raw = localStorage.getItem("hotkeys");
  if (raw) {
    try { this.__data = JSON.parse(raw); } catch(e) { this.__data = null; }
  }
  if (!this.__data || !this.__data.configs) {
    this.__data = {
      activeConfig: 0,
      configs: []
    };
    for (let i = 0; i < 5; i++) {
      this.__data.configs.push({ name: __("modal.hotkey.config").replace("%d", i + 1), bindings: [] });
    }
  }
}

HotkeyModal.prototype.__saveData = function() {
  localStorage.setItem("hotkeys", JSON.stringify(this.__data));
}

HotkeyModal.prototype.__renderConfigSelector = function() {
  let sel = document.getElementById("hotkey-config-selector");
  sel.innerHTML = "";
  this.__data.configs.forEach(function(config, i) {
    let opt = document.createElement("option");
    opt.value = i;
    opt.textContent = config.name;
    sel.appendChild(opt);
  });
  sel.value = this.__data.activeConfig;
}

HotkeyModal.prototype.__selectConfig = function(index) {
  this.__data.activeConfig = index;
  document.getElementById("hotkey-config-selector").value = index;
  this.__selectedIndex = -1;
  this.__renderList();
  this.__clearEdit();
}

HotkeyModal.prototype.__renderList = function() {
  let list = document.getElementById("hotkey-list");
  let config = this.__data.configs[this.__data.activeConfig];
  list.innerHTML = "";

  if (!config || config.bindings.length === 0) {
    let empty = document.createElement("div");
    empty.className = "hotkey-list-empty";
    empty.textContent = __("modal.hotkey.no_configured");
    list.appendChild(empty);
    return;
  }

  config.bindings.forEach(function(binding, i) {
    let row = document.createElement("div");
    row.className = "hotkey-list-row" + (i === this.__selectedIndex ? " selected" : "");

    let keySpan = document.createElement("span");
    keySpan.className = "hotkey-list-key";
    keySpan.textContent = binding.key;

    let textSpan = document.createElement("span");
    textSpan.className = "hotkey-list-text";
    textSpan.textContent = binding.text || "(empty)";
    if (!binding.text) textSpan.style.color = "#666";

    row.appendChild(keySpan);
    row.appendChild(textSpan);

    row.addEventListener("click", function() {
      this.__selectRow(i);
    }.bind(this));

    row.addEventListener("dblclick", function() {
      this.__selectRow(i);
      document.getElementById("hotkey-text-input").focus();
    }.bind(this));

    list.appendChild(row);
  }, this);

  this.__updateScrollbar();
}

HotkeyModal.prototype.__updateScrollbar = function() {
  let list = document.getElementById("hotkey-list");
  let scrollbar = document.getElementById("hotkey-scrollbar");
  let thumb = document.getElementById("hotkey-scrollbar-thumb");

  if (list.scrollHeight <= list.clientHeight) {
    scrollbar.style.opacity = "0";
    return;
  }

  scrollbar.style.opacity = "1";
  let ratio = list.clientHeight / list.scrollHeight;
  let thumbHeight = Math.max(16, ratio * scrollbar.clientHeight);
  thumb.style.height = thumbHeight + "px";
  let scrollTop = list.scrollTop;
  let maxScroll = list.scrollHeight - list.clientHeight;
  let thumbTop = (scrollTop / maxScroll) * (scrollbar.clientHeight - thumbHeight);
  thumb.style.top = thumbTop + "px";
}

HotkeyModal.prototype.__selectRow = function(index) {
  this.__selectedIndex = index;
  let config = this.__data.configs[this.__data.activeConfig];
  if (!config || index < 0 || index >= config.bindings.length) return;

  let binding = config.bindings[index];
  this.__renderList();

  document.getElementById("hotkey-remove-btn").disabled = false;
  document.getElementById("hotkey-text-input").disabled = false;
  document.getElementById("hotkey-text-input").value = binding.text || "";
  document.getElementById("hotkey-send-auto").disabled = false;
  document.getElementById("hotkey-send-auto").checked = binding.auto || false;
}

HotkeyModal.prototype.__clearEdit = function() {
  this.__selectedIndex = -1;
  document.getElementById("hotkey-remove-btn").disabled = true;
  document.getElementById("hotkey-text-input").disabled = true;
  document.getElementById("hotkey-text-input").value = "";
  document.getElementById("hotkey-send-auto").disabled = true;
  document.getElementById("hotkey-send-auto").checked = false;
  document.getElementById("hotkey-remove-btn").disabled = true;
}

HotkeyModal.prototype.__addEventListeners = function() {
  document.getElementById("hotkey-config-selector").addEventListener("change", function(e) {
    this.__selectConfig(Number(e.target.value));
  }.bind(this));

  document.getElementById("hotkey-reset-btn").addEventListener("click", function() {
    this.__data.configs[this.__data.activeConfig].bindings = [];
    this.__selectConfig(this.__data.activeConfig);
    this.__saveData();
  }.bind(this));

  document.getElementById("hotkey-add-btn").addEventListener("click", function() {
    this.__openCapture();
  }.bind(this));

  document.getElementById("hotkey-remove-btn").addEventListener("click", function() {
    if (this.__selectedIndex < 0) return;
    let config = this.__data.configs[this.__data.activeConfig];
    config.bindings.splice(this.__selectedIndex, 1);
    this.__selectConfig(this.__data.activeConfig);
    this.__saveData();
  }.bind(this));

  document.getElementById("hotkey-text-input").addEventListener("input", function(e) {
    if (this.__selectedIndex < 0) return;
    let config = this.__data.configs[this.__data.activeConfig];
    config.bindings[this.__selectedIndex].text = e.target.value;
    this.__renderList();
    this.__saveData();
  }.bind(this));

  document.getElementById("hotkey-send-auto").addEventListener("change", function(e) {
    if (this.__selectedIndex < 0) return;
    let config = this.__data.configs[this.__data.activeConfig];
    config.bindings[this.__selectedIndex].auto = e.target.checked;
    this.__saveData();
  }.bind(this));

  document.getElementById("hotkey-list").addEventListener("scroll", function() {
    this.__updateScrollbar();
  }.bind(this));
}

HotkeyModal.prototype.__openCapture = function() {
  let captureModal = document.getElementById("hotkey-capture-modal");
  let preview = document.getElementById("hotkey-capture-preview");
  let addBtn = document.getElementById("hotkey-capture-add-btn");
  let cancelBtn = document.getElementById("hotkey-capture-cancel-btn");

  preview.textContent = __("modal.hotkey.current_none");
  addBtn.disabled = true;
  captureModal.style.display = "block";

  let capturedKey = null;

  let keyHandler = function(e) {
    e.preventDefault();
    e.stopPropagation();

    let keyName = null;
    if (e.keyCode >= 112 && e.keyCode <= 123) {
      keyName = "F" + (e.keyCode - 111);
    } else if (e.keyCode >= 65 && e.keyCode <= 90) {
      keyName = String.fromCharCode(e.keyCode);
    } else if (e.keyCode >= 48 && e.keyCode <= 57) {
      keyName = String.fromCharCode(e.keyCode);
    }

    if (!keyName) return;

    let config = this.__data.configs[this.__data.activeConfig];
    let exists = config.bindings.some(function(b) { return b.key === keyName; });
    if (exists) {
      preview.textContent = __("modal.hotkey.key_bound").replace("%s", keyName);
      return;
    }

    capturedKey = keyName;
    preview.textContent = "Current hotkey to add: " + keyName;
    addBtn.disabled = false;
  }.bind(this);

  let cleanup = function() {
    document.removeEventListener("keydown", keyHandler);
    captureModal.style.display = "none";
  }.bind(this);

  let escHandler = function(e) {
    if (e.keyCode === 27) {
      cleanup();
    }
  };

  document.addEventListener("keydown", keyHandler);
  document.addEventListener("keydown", escHandler);

  addBtn.addEventListener("click", function() {
    if (!capturedKey) return;
    let config = this.__data.configs[this.__data.activeConfig];
    config.bindings.push({ key: capturedKey, text: "", auto: false });
    this.__selectConfig(this.__data.activeConfig);
    this.__saveData();
    cleanup();
  }.bind(this), { once: true });

  cancelBtn.addEventListener("click", function() {
    cleanup();
  }.bind(this), { once: true });

  let origCleanup = cleanup;
  cleanup = function() {
    document.removeEventListener("keydown", keyHandler);
    document.removeEventListener("keydown", escHandler);
    captureModal.style.display = "none";
  };
}
