MobileFullscreen.prototype.__createMobileSlots = function () {
  if (this.__mobilePanel || !window.gameClient || !window.gameClient.player) return;

  var equipment = window.gameClient.player.equipment;
  if (!equipment) return;

  this.__originalSlotEls = [];
  this.__originalConditionsParent = null;
  this.__originalCapacityParent = null;

  var panel = document.createElement('div');
  panel.id = 'mobile-equipment';
  panel.setAttribute('containerIndex', '0');
  panel.style.cssText = 'position:fixed;right:6px;top:6px;z-index:2147483645;display:flex;flex-direction:row;gap:2px;pointer-events:auto;transform:scale(0.95);transform-origin:top right;';
  this.__mobilePanel = panel;

  var columns = [
    { slots: [], ids: [], extra: [
      function () {
        var col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;gap:1px;';

        var btnBase = 'background:none;background-color:#4a4a4a;border:1px solid #333;' +
          'border-radius:0;color:#d3d3d3;font-size:8px;padding:1px 0;margin:0;' +
          'width:32px;height:16px;cursor:pointer;touch-action:manipulation;' +
          'white-space:nowrap;text-align:center;';

        var intf = window.gameClient && window.gameClient.interface;

        var defs = [
          { id: 'mobile-bless-btn', text: 'Bls', handler: function () { if (intf) intf.modalManager.open('blessing-modal'); }},
          { id: 'mobile-guild-btn', text: 'Gld', handler: function () { if (intf) intf.modalManager.open('guild-modal'); }},
          { id: 'mobile-shop-btn',  text: 'Shp', handler: function () { if (intf) { intf.modalManager.open('shop-modal'); window.gameClient.send(new RequestPremiumBalancePacket()); }}},
          { id: 'mobile-gift-btn',  text: 'Gft', handler: function () { window.gameClient.send(new OpenGiftContainerPacket()); }}
        ];

        defs.forEach(function (b) {
          var btn = document.createElement('button');
          btn.id = b.id;
          btn.textContent = b.text;
          btn.style.cssText = btnBase;
          btn.addEventListener('click', b.handler);
          col.appendChild(btn);
        });

        return col;
      }
    ]},
    { slots: [7, 5, 8], ids: ['neck', 'left-hand', 'finger'], extra: [
      function () {
        var el = document.getElementById('conditions-display');
        if (el && el.parentNode) {
          this.__originalConditionsParent = el.parentNode;
          return el.parentNode.removeChild(el);
        }
        return null;
      }
    ]},
    { slots: [0, 1, 2, 3], ids: ['head', 'body', 'legs', 'feet'], extra: [] },
    { slots: [6, 4, 9], ids: ['back', 'right-hand', 'ammo'], extra: [
      function () {
        var el = document.querySelector('.capacity-display');
        if (el && el.parentNode) {
          this.__originalCapacityParent = el.parentNode;
          el.parentNode.removeChild(el);
        }
        return el;
      }
    ]},
    { slots: [], ids: [], extra: [
      function () {
        var btnCol = document.createElement('div');
        btnCol.style.cssText = 'display:flex;flex-direction:column;gap:1px;';

        var btnBaseStyle = 'background:none;background-color:#4a4a4a;border:1px solid #333;' +
          'border-radius:0;color:#d3d3d3;font-size:8px;padding:1px 0;margin:0;' +
          'width:32px;height:16px;cursor:pointer;touch-action:manipulation;' +
          'white-space:nowrap;text-align:center;';

        var intf = window.gameClient && window.gameClient.interface;

        function toggleModal(name) {
          if (!intf) return;
          var mm = intf.modalManager;
          var modal = mm.get(name);
          if (modal && modal.element && modal.element.style.display === 'block') {
            mm.close();
          } else {
            mm.open(name);
          }
        }

        var buttonDefs = [
          { id: 'openSkills',   text: 'Sk',    handler: function () { if (intf) intf.toggleWindow('skill-window'); } },
          { id: 'openBattle',   text: 'Bat',   handler: function () { if (intf) intf.toggleWindow('battle-window'); } },
          { id: 'openVipList',  text: 'VIP',   handler: function () { if (intf) intf.toggleWindow('friend-window'); } },
          { id: 'openQuests',   text: 'Qst',   handler: function () { toggleModal('quest-log-modal'); } },

          { id: 'openSettings', text: 'Opt',   handler: function () { toggleModal('settings-modal'); } },
          { id: 'logout-button',text: 'Ext',   handler: function () { if (intf) intf.sendLogout(); } }
        ];

        buttonDefs.forEach(function (b) {
          var btn = document.createElement('button');
          btn.id = b.id;
          btn.textContent = b.text;
          btn.style.cssText = btnBaseStyle;
          btn.addEventListener('click', b.handler);
          btnCol.appendChild(btn);
        });

        return btnCol;
      }
    ]}
  ];

  for (var c = 0; c < columns.length; c++) {
    var col = document.createElement('div');
    col.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    for (var s = 0; s < columns[c].slots.length; s++) {
      var slotIndex = columns[c].slots[s];
      var slotId = columns[c].ids[s];

      var slotEl = document.createElement('div');
      slotEl.className = 'slot';
      slotEl.setAttribute('slotIndex', slotIndex);
      slotEl.style.cssText = 'width:32px;height:32px;position:relative;touch-action:auto;';

      var canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      canvas.style.cssText = 'width:32px;height:32px;position:absolute;top:0;left:0;z-index:100;pointer-events:none;';
      slotEl.appendChild(canvas);

      var count = document.createElement('span');
      count.className = 'count';
      count.style.cssText = 'color:#d3d3d3;font-size:10px;font-weight:bold;position:absolute;bottom:2px;right:4px;pointer-events:none;z-index:100;text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000;touch-action:auto;';
      slotEl.appendChild(count);

      col.appendChild(slotEl);

      if (equipment.slots[slotIndex]) {
        this.__originalSlotEls[slotIndex] = equipment.slots[slotIndex].element;
        equipment.slots[slotIndex].setElement(slotEl);
        equipment.slots[slotIndex].render();
        if (equipment.slots[slotIndex].item) {
          slotEl.style.backgroundImage = "url('/images/game/ui/item.png')";
        }
      }
    }

    for (var e = 0; e < columns[c].extra.length; e++) {
      var extraEl = columns[c].extra[e].call(this);
      if (extraEl) {
        col.appendChild(extraEl);
      }
    }

    panel.appendChild(col);
  }

  document.body.appendChild(panel);

  this.__enableLockableDrag(panel, 'equip', { onDragStart: function () {}, onDragEnd: function () {} });
};

MobileFullscreen.prototype.__destroyMobileSlots = function () {
  if (!this.__mobilePanel) return;

  this.__saveModuleState(this.__mobilePanel, 'equip');

  if (window.gameClient && window.gameClient.player && window.gameClient.player.equipment && this.__originalSlotEls) {
    for (var i = 0; i < this.__originalSlotEls.length; i++) {
      if (this.__originalSlotEls[i] && window.gameClient.player.equipment.slots[i]) {
        window.gameClient.player.equipment.slots[i].setElement(this.__originalSlotEls[i]);
        window.gameClient.player.equipment.slots[i].render();
      }
    }
  }

  var conditionsEl = document.getElementById('conditions-display');
  if (conditionsEl && this.__originalConditionsParent) {
    this.__originalConditionsParent.appendChild(conditionsEl);
  }

  var capacityEl = document.querySelector('.capacity-display');
  if (capacityEl && this.__originalCapacityParent) {
    this.__originalCapacityParent.appendChild(capacityEl);
  }

  this.__mobilePanel.remove();
  this.__mobilePanel = null;
  this.__originalSlotEls = null;
  this.__originalConditionsParent = null;
  this.__originalCapacityParent = null;
};
