MobileFullscreen.prototype.__saveActionbarData = function () {
  if (!gameClient || !gameClient.player) return;
  try {
    var data = [];
    for (var i = 0; i < this.__actionbarSlots.length; i++) {
      var slot = this.__actionbarSlots[i];
      if (slot) {
        var containerIdx = -1;
        if (slot.which === gameClient.player.equipment) {
          containerIdx = -2;
        } else {
          for (var j = 0; j < 256; j++) {
            var cont = gameClient.player.getContainer(j);
            if (cont && cont === slot.which) { containerIdx = j; break; }
          }
        }
        data.push({ ci: containerIdx, si: slot.index });
      } else {
        data.push(null);
      }
    }
    localStorage.setItem('retrogo_actionbar_data', JSON.stringify(data));
  } catch(e) {}
};

MobileFullscreen.prototype.__renderActionbarSlot = function (index) {
  if (!this.__actionbarEl) return;
  var slotEls = this.__actionbarEl.querySelectorAll('.actionbar-slot');
  if (index >= slotEls.length) return;
  var slotEl = slotEls[index];
  var data = this.__actionbarSlots[index];
  var canvasEl = slotEl.querySelector('canvas');
  var countEl = slotEl.querySelector('.count');
  if (!canvasEl) return;

  if (!data) {
    var ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    if (countEl) countEl.style.display = 'none';
    return;
  }

  var item = data.which.peekItem(data.index);
  if (!item) {
    this.__actionbarSlots[index] = null;
    var ctx = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    if (countEl) countEl.style.display = 'none';
    return;
  }

  if (!this.__actionbarCanvases[index]) {
    this.__actionbarCanvases[index] = new Canvas(canvasEl, 32, 32);
  }
  this.__actionbarCanvases[index].clear();
  this.__actionbarCanvases[index].drawSprite(item, false, false);

  if (countEl) {
    if (item.isStackable && item.count > 1) {
      countEl.textContent = item.count;
      countEl.style.display = '';
    } else {
      countEl.style.display = 'none';
    }
  }
};

MobileFullscreen.prototype.__updateActionbarHighlight = function () {
  if (!this.__actionbarEl) return;
  var highlighted = -1;
  if (gameClient && gameClient.mouse && gameClient.mouse.__multiUseObject) {
    var muo = gameClient.mouse.__multiUseObject;
    for (var i = 0; i < this.__actionbarSlots.length; i++) {
      var slot = this.__actionbarSlots[i];
      if (slot && slot.which === muo.which && slot.index === muo.index) {
        highlighted = i;
        break;
      }
    }
  }
  if (highlighted !== this.__actionbarHighlight) {
    this.__actionbarHighlight = highlighted;
    var slotEls = this.__actionbarEl.querySelectorAll('.actionbar-slot');
    for (var j = 0; j < slotEls.length; j++) {
      slotEls[j].classList.toggle('highlighted', j === highlighted);
    }
  }
};

MobileFullscreen.prototype.__handleActionbarUse = function (index) {
  if (!this.active || !gameClient || !gameClient.player) return;
  var data = this.__actionbarSlots[index];
  if (!data) return;
  var item = data.which.peekItem(data.index);
  if (!item) {
    this.__actionbarSlots[index] = null;
    this.__renderActionbarSlot(index);
    this.__saveActionbarData();
    return;
  }
  gameClient.mouse.use({ which: data.which, index: data.index });
  this.__updateActionbarHighlight();
};

MobileFullscreen.prototype.__createActionbar = function () {
  if (this.__actionbarEl || !gameClient || !gameClient.player) return;

  var self = this;
  var bar = document.createElement('div');
  bar.id = 'actionbar';
  bar.style.cssText = 'display:flex;flex-direction:row;align-items:center;gap:0;';

  for (var i = 0; i < 8; i++) {
    (function (slotIndex) {
      var slotEl = document.createElement('div');
      slotEl.className = 'actionbar-slot';
      slotEl.setAttribute('slotIndex', slotIndex);

      var canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      slotEl.appendChild(canvas);

      var count = document.createElement('span');
      count.className = 'count';
      count.style.display = 'none';
      slotEl.appendChild(count);

      slotEl.addEventListener('touchstart', function (e) {
        if (self.__lockStates.actionbar === false) return;
        self.__tapStartX = e.changedTouches[0].clientX;
        self.__tapStartY = e.changedTouches[0].clientY;
        self.__tapSlotIndex = slotIndex;
      }, { passive: true });

      slotEl.addEventListener('touchend', function (e) {
        if (self.__lockStates.actionbar === false) return;
        if (self.__tapSlotIndex !== slotIndex) return;
        var touch = e.changedTouches[0];
        var dx = touch.clientX - self.__tapStartX;
        var dy = touch.clientY - self.__tapStartY;
        if (dx * dx + dy * dy < 64) {
          e.preventDefault();
          self.__handleActionbarUse(slotIndex);
        }
        self.__tapSlotIndex = -1;
      });

      bar.appendChild(slotEl);
    })(i);
  }

  document.body.appendChild(bar);
  this.__actionbarEl = bar;

  if (!localStorage.getItem('retrogo_actionbar_pos')) {
    bar.style.left = Math.round((window.innerWidth - bar.offsetWidth) / 2) + 'px';
    bar.style.bottom = 'auto';
  }

  try {
    var saved = localStorage.getItem('retrogo_actionbar_data');
    if (saved) {
      var data = JSON.parse(saved);
      for (var k = 0; k < data.length && k < 8; k++) {
        if (data[k]) {
          var d = data[k];
          var which = null;
          if (d.ci === -2) {
            which = gameClient.player.equipment;
          } else if (d.ci >= 0) {
            which = gameClient.player.getContainer(d.ci);
          }
          if (which && which.peekItem(d.si)) {
            this.__actionbarSlots[k] = { which: which, index: d.si };
          }
        }
      }
    }
  } catch(e) {}

  for (var r = 0; r < 8; r++) {
    this.__renderActionbarSlot(r);
  }

  this.__actionbarEl.classList.add('visible');
  this.__enableLockableDrag(bar, 'actionbar', { onDragStart: function () {}, onDragEnd: function () {} });
  this.__updateActionbarHighlight();
};

MobileFullscreen.prototype.__destroyActionbar = function () {
  if (!this.__actionbarEl) return;
  this.__saveActionbarData();
  this.__actionbarEl.remove();
  this.__actionbarEl = null;
  this.__actionbarCanvases = [];
};
