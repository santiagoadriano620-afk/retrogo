MobileFullscreen.prototype.__showMobileCountSelector = function (fromObject, toObject, fromItem) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
    'background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:2147483647;';

  var win = document.createElement('div');
  win.style.cssText = 'display:flex;flex-direction:column;width:150px;color:#d3d3d3;' +
    'border-width:22px 6px 4px 6px;border-style:solid;border-color:transparent;' +
    'border-image-source:url("/images/game/ui/window.png");' +
    'border-image-slice:22 6 4 6 fill;border-image-repeat:stretch;';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;height:22px;' +
    'margin:-22px -6px 0 -6px;padding:0 4px;';

  var title = document.createElement('span');
  title.textContent = 'Move Item';
  title.style.cssText = 'flex:1;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#d3d3d3;pointer-events:none;';

  var closeBtn = document.createElement('button');
  closeBtn.textContent = 'X';
  closeBtn.style.cssText = 'flex:0 0 auto;background:none;border:none;color:#ccc;cursor:pointer;font-size:10px;padding:0 4px;';

  header.appendChild(title);
  header.appendChild(closeBtn);

  var body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-direction:row;align-items:center;justify-content:center;padding:4px 4px;gap:4px;';

  var spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 32;
  spriteCanvas.height = 32;
  spriteCanvas.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;flex:0 0 auto;';
  var ctx = spriteCanvas.getContext('2d');
  var frameGroup = fromItem.getFrameGroup(FrameGroup.prototype.NONE);
  if (frameGroup) {
    var frame = fromItem.getFrame();
    var pattern = fromItem.getPattern();
    var spriteIndex = frameGroup.getSpriteIndex(frame, pattern.x, pattern.y, pattern.z, 0, 0, 0);
    var spriteSrc = frameGroup.getSprite(spriteIndex);
    if (spriteSrc && spriteSrc.src) {
      ctx.drawImage(spriteSrc.src, 32 * spriteSrc.position.x, 32 * spriteSrc.position.y, 32, 32, 0, 0, 32, 32);
    }
  }

  var countLabel = document.createElement('span');
  countLabel.textContent = String(fromItem.count);
  countLabel.style.cssText = 'font-size:11px;color:#d3d3d3;min-width:20px;text-align:center;';

  var slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '1';
  slider.max = String(fromItem.count);
  slider.value = String(fromItem.count);
  slider.style.cssText = 'flex:1;min-width:0;height:16px;margin:0;';

  slider.addEventListener('input', function () { countLabel.textContent = slider.value; });

  var okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.style.cssText = 'padding:2px 8px;background:none;border:1px solid #555;color:#ccc;cursor:pointer;font-size:10px;flex:0 0 auto;';

  okBtn.addEventListener('click', function () {
    overlay.remove();
    var count = parseInt(slider.value, 10) || 1;
    if (gameClient && gameClient.mouse) gameClient.mouse.sendItemMove(fromObject, toObject, count);
  });

  closeBtn.addEventListener('click', function () { overlay.remove(); });

  body.appendChild(spriteCanvas);
  body.appendChild(countLabel);
  body.appendChild(slider);
  body.appendChild(okBtn);

  win.appendChild(header);
  win.appendChild(body);
  overlay.appendChild(win);
  document.body.appendChild(overlay);
};

MobileFullscreen.prototype.__getSlotObjectFromEvent = function (event) {
  var slotEl = event.target.closest('.slot');
  if (!slotEl) return null;
  var slotIndex = Number(slotEl.getAttribute('slotIndex'));
  var containerWindow = slotEl.closest('[containerIndex]');
  var containerIdx = containerWindow ? Number(containerWindow.getAttribute('containerIndex')) : NaN;
  var container = gameClient.player.getContainer(containerIdx);
  if (container && container.slots && container.slots[slotIndex]) {
    var slot = container.slots[slotIndex];
    if (slot && slot.item) {
      return { which: container, index: slotIndex };
    }
  }
  return null;
};

MobileFullscreen.prototype.__getGroundObjectFromEvent = function (event) {
  if (!gameClient || !gameClient.mouse || !gameClient.renderer) return null;
  var worldObj = gameClient.mouse.getWorldObject({ clientX: event.clientX, clientY: event.clientY, target: gameClient.renderer.screen.canvas });
  if (worldObj && worldObj.which) {
    var tile = worldObj.which;
    if (tile.items && tile.items.length > 0) {
      var topItem = tile.peekItem(0xFF);
      if (topItem && topItem.isMoveable && topItem.isMoveable()) {
        var player = gameClient.player;
        if (player) {
          var pPos = player.getPosition();
          var tPos = tile.getPosition();
          if (Math.abs(pPos.x - tPos.x) > 1 || Math.abs(pPos.y - tPos.y) > 1) {
            return null;
          }
        }
        return worldObj;
      }
    }
  }
  return null;
};

MobileFullscreen.prototype.__bindSlotTouch = function () {
  var self = this;
  this.__dragSource = null;
  this.__dragSprite = null;
  var dragThreshold = 8;

  var resolveSource = function (e) {
    var touch = e.changedTouches[0];
    var obj = self.__getSlotObjectFromEvent({ target: e.target, clientX: touch.clientX, clientY: touch.clientY });
    if (obj) {
      obj.startX = touch.clientX;
      obj.startY = touch.clientY;
      // Resolve CI from __containerId directly (container reference may become stale by touchend)
      var objCI = -3;
      if (obj.which === gameClient.player.equipment) {
        objCI = -2;
      } else if (obj.which && typeof obj.which.__containerId === 'number') {
        objCI = obj.which.__containerId;
      }
      obj.__sourceCI = objCI;
      return obj;
    }

    // Drag from actionbar slot
    var abSlotEl = e.target.closest('.actionbar-slot');
    if (abSlotEl) {
      var abIdx = Number(abSlotEl.getAttribute('slotIndex'));
      var abData = self.__actionbarSlots[abIdx];
      if (abData && abData.ci !== undefined) {
        var which = self.__getContainerFromCI(abData.ci);
        if (which && which.peekItem(abData.index)) {
          return { which: which, index: abData.index, startX: touch.clientX, startY: touch.clientY, __actionbarSource: abIdx, __abItemId: abData.itemId };
        }
      }
      return null;
    }

    if (e.target.closest('#canvas-id') || e.target.closest('#screen')) {
      var groundObj = self.__getGroundObjectFromEvent({ clientX: touch.clientX, clientY: touch.clientY });
      if (groundObj) {
        groundObj.startX = touch.clientX;
        groundObj.startY = touch.clientY;
        return groundObj;
      }
    }
    return null;
  };

  var handleTouchStart = function (e) {
    if (!self.active || !gameClient || !gameClient.player) return;
    self.__dragSprite = null;
    if (e.target.closest('.window .header')) return;
    if (e.target.closest('.window .footer')) return;
    var source = resolveSource(e);
    if (source) {
      self.__dragSource = source;
      e.preventDefault();
    }
  };

  var handleTouchMove = function (e) {
    if (!self.__dragSource) return;
    if (!gameClient || !gameClient.mouse) return;
    var touch = e.changedTouches[0];
    var dx = touch.clientX - self.__dragSource.startX;
    var dy = touch.clientY - self.__dragSource.startY;
    if (dx * dx + dy * dy < dragThreshold * dragThreshold) return;

    if (!self.__dragSprite) {
      if (__canvasEl) __canvasEl.style.pointerEvents = 'none';
      gameClient.mouse.__renderDragSprite({ which: self.__dragSource.which, index: self.__dragSource.index });
      self.__dragSprite = gameClient.mouse.__dragSprite;
    }
    gameClient.mouse.__updateDragSpritePosition({ clientX: touch.clientX, clientY: touch.clientY });
    e.preventDefault();
  };

  var __canvasEl = document.getElementById('canvas-id');

  var __actionbarSlotsByPoint = function (clientX, clientY) {
    var slots = document.querySelectorAll('.actionbar-slot');
    if (!slots || !slots.length) return -1;
    for (var i = 0; i < slots.length; i++) {
      var r = slots[i].getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right &&
          clientY >= r.top && clientY <= r.bottom) {
        var idx = Number(slots[i].getAttribute('slotIndex'));
        if (!isNaN(idx)) return idx;
      }
    }
    return -1;
  };

  var getDropTarget = function (touch) {
    // Always check actionbar slots by bounding rect first (most reliable)
    var abIdx = __actionbarSlotsByPoint(touch.clientX, touch.clientY);
    if (abIdx >= 0) {
      return { isActionbar: true, index: abIdx };
    }

    var dropEl = document.elementFromPoint(touch.clientX, touch.clientY);

    // Fallback: if elementFromPoint returns the drag sprite (z-index on top of everything),
    // check geometrically if the touch is within the canvas bounds
    if (dropEl && !dropEl.closest('#screen') && !dropEl.closest('#canvas-id') && !dropEl.closest('.slot') && !dropEl.closest('.actionbar-slot') && !dropEl.closest('.container-window')) {
      var canvas = document.getElementById('canvas-id');
      if (canvas) {
        var rect = canvas.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          return gameClient.mouse.getWorldObject({ clientX: touch.clientX, clientY: touch.clientY, target: gameClient.renderer.screen.canvas });
        }
      }
    }

    if (!dropEl) return null;

    if (dropEl.closest('#screen') || dropEl.closest('#canvas-id')) {
      return gameClient.mouse.getWorldObject({ clientX: touch.clientX, clientY: touch.clientY, target: gameClient.renderer.screen.canvas });
    }

    // Actionbar slot drop via elementFromPoint (fallback)
    var abSlot = dropEl.closest('.actionbar-slot');
    if (abSlot) {
      var abIndex = Number(abSlot.getAttribute('slotIndex'));
      if (!isNaN(abIndex)) {
        return { isActionbar: true, index: abIndex };
      }
    }

    var targetSlot = dropEl.closest('.slot');
    if (targetSlot) {
      var slotIndex = Number(targetSlot.getAttribute('slotIndex'));
      var containerWindow = targetSlot.closest('[containerIndex]');
      var containerIdx = containerWindow ? Number(containerWindow.getAttribute('containerIndex')) : NaN;
      var container = gameClient.player.getContainer(containerIdx);
      if (container) {
        return { which: container, index: slotIndex };
      }
    }

    var containerBg = dropEl.closest('.container-window');
    if (containerBg) {
      var cw = containerBg.closest('[containerIndex]');
      if (cw) {
        var idx = Number(cw.getAttribute('containerIndex'));
        var cont = gameClient.player.getContainer(idx);
        if (cont) {
          for (var i = 0; i < cont.slots.length; i++) {
            if (!cont.slots[i] || !cont.slots[i].item) {
              return { which: cont, index: i };
            }
          }
        }
      }
    }

    return null;
  };

  var __restoreCanvasPointer = function () {
    if (__canvasEl) __canvasEl.style.pointerEvents = '';
  };

  var handleTouchEnd = function (e) {
    if (!self.__dragSource) { __restoreCanvasPointer(); self.__dragSprite = null; return; }

    var touch = e.changedTouches[0];
    var dx = touch.clientX - self.__dragSource.startX;
    var dy = touch.clientY - self.__dragSource.startY;
    var moved = dx * dx + dy * dy >= dragThreshold * dragThreshold;

    // No-move: clear drag sprite or handle container tap
    if (!moved) {
      __restoreCanvasPointer();
      if (self.__dragSprite) {
        if (gameClient && gameClient.mouse) gameClient.mouse.__clearDragSprite();
        self.__dragSprite = null;
        self.__dragSource = null;
        return;
      }
      e.preventDefault();
      var sourceItem = self.__dragSource.which && self.__dragSource.which.peekItem(self.__dragSource.index);
      if (sourceItem && sourceItem.isContainer && sourceItem.isContainer()) {
        gameClient.mouse.use({ which: self.__dragSource.which, index: self.__dragSource.index });
      } else if (sourceItem && self.__dragSource.which.constructor && self.__dragSource.which.constructor.name === 'Tile') {
        gameClient.mouse.use({ which: self.__dragSource.which, index: self.__dragSource.index });
      }
      self.__dragSource = null;
      return;
    }

    // Moved past threshold — always process drop regardless of dragSprite
    e.preventDefault();
    var fromObject = { which: self.__dragSource.which, index: self.__dragSource.index };
    var abSourceIdx = self.__dragSource.__actionbarSource;
    var toObject = getDropTarget(touch);

    // Drop on actionbar slot → store reference instead of moving item
    if (toObject && toObject.isActionbar) {
      var abSlot = toObject.index;
      var slotCount = self.__getActionbarSlotCount();
      if (abSlot >= 0 && abSlot < slotCount) {
        var item = fromObject.which.peekItem(fromObject.index);
        if (item && item.isMultiUse && item.isMultiUse()) {
            // Use CI resolved at touchstart (container reference may be stale now)
            var fromCI = self.__dragSource.__sourceCI !== undefined ? self.__dragSource.__sourceCI : -3;
            // Clear previous source slot if dragging from another actionbar slot
          if (abSourceIdx !== undefined && abSourceIdx !== abSlot) {
            self.__actionbarSlots[abSourceIdx] = null;
          }
          var itemId = item.id;
          if (abSourceIdx !== undefined && self.__dragSource.__abItemId !== undefined) {
            itemId = self.__dragSource.__abItemId;
          }
          self.__actionbarSlots[abSlot] = { ci: fromCI, index: fromObject.index, itemId: itemId };
          self.__renderActionbarSlot(abSlot);
          if (abSourceIdx !== undefined && abSourceIdx !== abSlot) {
            self.__renderActionbarSlot(abSourceIdx);
          }
          self.__saveActionbarData();
        } else if (item) {
          if (gameClient && gameClient.interface && gameClient.interface.notificationManager) {
            gameClient.interface.notificationManager.setCancelMessage("You can only use multi-use items on the actionbar.");
          }
        }
      }
    } else if (abSourceIdx !== undefined) {
      // Drag from actionbar to ground/container: move item, clear actionbar slot
      if (toObject && toObject.which) {
        gameClient.mouse.sendItemMove(fromObject, toObject, 1);
      }
      self.__actionbarSlots[abSourceIdx] = null;
      self.__renderActionbarSlot(abSourceIdx);
      self.__saveActionbarData();
    } else if (toObject && toObject.which) {
      var fromItem = fromObject.which && fromObject.which.peekItem(fromObject.index);
      if (fromItem && fromItem.isStackable && fromItem.isStackable() && fromItem.count > 1) {
        self.__showMobileCountSelector(fromObject, toObject, fromItem);
      } else {
        gameClient.mouse.sendItemMove(fromObject, toObject, 1);
      }
    }

    if (gameClient && gameClient.mouse && self.__dragSprite) {
      gameClient.mouse.__clearDragSprite();
    }

    __restoreCanvasPointer();
    self.__dragSprite = null;
    self.__dragSource = null;
  };

  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
};
