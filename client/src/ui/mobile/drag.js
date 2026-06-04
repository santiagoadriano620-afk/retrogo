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
          return { which: which, index: abData.index, startX: touch.clientX, startY: touch.clientY, __actionbarSource: abIdx };
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
      gameClient.mouse.__renderDragSprite({ which: self.__dragSource.which, index: self.__dragSource.index });
      self.__dragSprite = gameClient.mouse.__dragSprite;
    }
    gameClient.mouse.__updateDragSpritePosition({ clientX: touch.clientX, clientY: touch.clientY });
    e.preventDefault();
  };

  var getDropTarget = function (touch) {
    var dropEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!dropEl) return null;

    if (dropEl.closest('#screen') || dropEl.closest('#canvas-id')) {
      return gameClient.mouse.getWorldObject({ clientX: touch.clientX, clientY: touch.clientY, target: gameClient.renderer.screen.canvas });
    }

    // Actionbar slot drop
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

  var handleTouchEnd = function (e) {
    if (!self.__dragSource) { self.__dragSprite = null; return; }

    var touch = e.changedTouches[0];
    var dx = touch.clientX - self.__dragSource.startX;
    var dy = touch.clientY - self.__dragSource.startY;
    var moved = dx * dx + dy * dy >= dragThreshold * dragThreshold;

    if (!moved && self.__dragSprite) {
      if (gameClient && gameClient.mouse) gameClient.mouse.__clearDragSprite();
      self.__dragSprite = null;
      self.__dragSource = null;
      return;
    }

    if (!moved) {
      e.preventDefault();
      var sourceItem = self.__dragSource.which && self.__dragSource.which.peekItem(self.__dragSource.index);
      if (sourceItem && sourceItem.isContainer && sourceItem.isContainer()) {
        gameClient.mouse.use({ which: self.__dragSource.which, index: self.__dragSource.index });
      }
      self.__dragSource = null;
      return;
    }

    if (gameClient && gameClient.mouse && self.__dragSprite) {
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
          if (item) {
            // Resolve CI from the fromObject
            var fromCI = -3;
            if (fromObject.which === gameClient.player.equipment) {
              fromCI = -2;
            } else {
              for (var fc = 0; fc < 256; fc++) {
                var fcont = gameClient.player.getContainer(fc);
                if (fcont && fcont === fromObject.which) { fromCI = fc; break; }
              }
            }
            // Clear previous source slot if dragging from another actionbar slot
            if (abSourceIdx !== undefined && abSourceIdx !== abSlot) {
              self.__actionbarSlots[abSourceIdx] = null;
            }
            self.__actionbarSlots[abSlot] = { ci: fromCI, index: fromObject.index };
            self.__renderActionbarSlot(abSlot);
            if (abSourceIdx !== undefined && abSourceIdx !== abSlot) {
              self.__renderActionbarSlot(abSourceIdx);
            }
            self.__saveActionbarData();
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
        gameClient.mouse.sendItemMove(fromObject, toObject, 1);
      }
      gameClient.mouse.__clearDragSprite();
    }

    self.__dragSprite = null;
    self.__dragSource = null;
  };

  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
};
