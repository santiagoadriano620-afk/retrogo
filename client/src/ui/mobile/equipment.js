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
  panel.style.cssText = 'position:fixed;right:6px;top:6px;z-index:2147483645;display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:auto;transform:scale(0.95);transform-origin:top right;';
  this.__mobilePanel = panel;

  // Top row with Bls, Gld, Shp, Gft centered above slots
  var topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;flex-direction:row;justify-content:center;gap:2px;width:100%;';

  var btnBase = 'background:none;background-color:#4a4a4a;border:1px solid #333;' +
    'border-radius:0;color:#d3d3d3;font-size:8px;padding:0;margin:0;' +
    'width:22px;height:16px;cursor:pointer;touch-action:manipulation;' +
    'background-size:contain;background-repeat:no-repeat;background-position:center;';

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

  var self = this;

  var defs = [
    { id: 'mobile-bless-btn', icon: '/images/icons/crystal_01a.png', handler: function () { toggleModal('blessing-modal'); }},
    { id: 'mobile-guild-btn', icon: '/images/icons/shield_01a.png', handler: function () { toggleModal('guild-modal'); }},
    { id: 'mobile-shop-btn',  icon: '/images/icons/coin_01a.png', handler: function () {
      var shopOpen = intf && intf.modalManager.get('shop-modal') &&
        intf.modalManager.get('shop-modal').element &&
        intf.modalManager.get('shop-modal').element.style.display === 'block';
      toggleModal('shop-modal');
      if (!shopOpen) window.gameClient.send(new RequestPremiumBalancePacket());
    }},
    { id: 'mobile-gift-btn',  icon: '/images/icons/gift_01a.png', handler: function () {
      var containers = window.gameClient && window.gameClient.player && window.gameClient.player.__openedContainers;
      if (self.__giftToggle) {
        self.__giftToggle = false;
        if (containers && containers.size > 0) {
          var arr = Array.from(containers);
          window.gameClient.player.removeContainer(arr[arr.length - 1]);
        }
      } else {
        self.__giftToggle = true;
        window.gameClient.send(new OpenGiftContainerPacket());
      }
    }}
  ];

  defs.forEach(function (b) {
    var btn = document.createElement('button');
    btn.id = b.id;
    btn.style.cssText = b.icon ? btnBase : btnBase + 'width:auto;padding:1px 3px;background-image:none;';
    if (b.icon) {
      btn.style.backgroundImage = "url('" + b.icon + "')";
    } else {
      btn.textContent = b.text;
    }
    btn.addEventListener('click', b.handler);
    topRow.appendChild(btn);
  });

  panel.appendChild(topRow);

  var slotContainer = document.createElement('div');
  slotContainer.style.cssText = 'display:flex;flex-direction:row;gap:2px;';
  panel.appendChild(slotContainer);

  var columns = [
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
    { slots: [], ids: [], extra: [function () {
      // Combat modes — two columns side-by-side like desktop
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;flex-direction:row;gap:1px;';
      wrapper.id = 'mobile-combat-modes';

      var btnStyle = 'width:20px;height:20px;background:none;background-color:#3a3a3a;border:1px solid #555;border-radius:2px;cursor:pointer;padding:0;margin:0;background-size:20px 40px;background-repeat:no-repeat;background-position:0 0;';

      // Left column: fight modes (offensive, balanced, defensive)
      var leftCol = document.createElement('div');
      leftCol.style.cssText = 'display:flex;flex-direction:column;gap:1px;';
      var fms = [
        { m: 0, i: '/images/game/combatmodes/fightoffensive.png', t: __('equip.combat.full_attack') },
        { m: 1, i: '/images/game/combatmodes/fightbalanced.png', t: __('equip.combat.balanced') },
        { m: 2, i: '/images/game/combatmodes/fightdefensive.png', t: __('equip.combat.full_defense') }
      ];
      fms.forEach(function (fm) {
        var b = document.createElement('button');
        b.style.cssText = btnStyle;
        b.style.backgroundImage = "url('" + fm.i + "')";
        b.title = fm.t;
        b.className = 'mobile-fight-btn';
        b.setAttribute('data-fight', fm.m);
        b.addEventListener('click', function () {
          var sel = gameClient && gameClient.interface && gameClient.interface.fightModeSelector;
          if (sel) sel.setFightMode(fm.m);
          self.__syncCombatVisState();
        });
        leftCol.appendChild(b);
      });
      wrapper.appendChild(leftCol);

      // Right column: chase modes (stand, chase, safe fight)
      var rightCol = document.createElement('div');
      rightCol.style.cssText = 'display:flex;flex-direction:column;gap:1px;';
      var cms = [
        { m: 0, i: '/images/game/combatmodes/standmode.png', t: __('equip.combat.stand') },
        { m: 1, i: '/images/game/combatmodes/chasemode.png', t: __('equip.combat.chase') },
        { i: '/images/game/combatmodes/safefight.png', t: __('equip.combat.safe_fight'), s: true }
      ];
      cms.forEach(function (cm) {
        var b = document.createElement('button');
        b.style.cssText = btnStyle;
        b.style.backgroundImage = "url('" + cm.i + "')";
        b.title = cm.t;
        if (cm.m !== undefined) {
          b.className = 'mobile-chase-btn';
          b.setAttribute('data-chase', cm.m);
        } else {
          b.className = 'mobile-safefight-btn';
        }
        if (cm.s) {
          b.addEventListener('click', function () {
            var sel = gameClient && gameClient.interface && gameClient.interface.fightModeSelector;
            if (sel) sel.toggleSafeFight();
            self.__syncCombatVisState();
          });
        } else {
          b.addEventListener('click', function () {
            var sel = gameClient && gameClient.interface && gameClient.interface.fightModeSelector;
            if (sel) sel.setChaseMode(cm.m);
            self.__syncCombatVisState();
          });
        }
        rightCol.appendChild(b);
      });
      wrapper.appendChild(rightCol);

      return wrapper;
    }]}
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

    slotContainer.appendChild(col);
  }

  // Action buttons (2 rows x 3 cols) below equipment
  var btnRowContainer = document.createElement('div');
  btnRowContainer.style.cssText = 'display:flex;flex-direction:column;gap:2px;width:100%;margin-top:3px;';

  var btnRBase = 'background:none;background-color:#4a4a4a;border:1px solid #333;border-radius:0;color:#d3d3d3;font-size:8px;padding:1px 2px;margin:0;cursor:pointer;touch-action:manipulation;white-space:nowrap;text-align:center;';

  var rows = [
    [
      { id: 'mobile-openSkills',  text: __('equip.skills'),  handler: function () { if (intf) intf.toggleWindow('skill-window'); } },
      { id: 'mobile-openBattle',  text: __('equip.battle'),  handler: function () { if (intf) intf.toggleWindow('battle-window'); } },
      { id: 'mobile-openVip',     text: __('equip.vip'),     handler: function () { if (intf) intf.toggleWindow('friend-window'); } }
    ],
    [
      { id: 'mobile-openQuests',  text: __('equip.quests'),  handler: function () { toggleModal('quest-log-modal'); } },
      { id: 'mobile-openOptions', text: __('equip.options'), handler: function () { toggleModal('settings-modal'); } },
      { id: 'mobile-logout',      text: __('equip.logout'),  handler: function () { if (intf) intf.sendLogout(); } }
    ]
  ];

  rows.forEach(function (rowDefs) {
    var rowDiv = document.createElement('div');
    rowDiv.style.cssText = 'display:flex;flex-direction:row;gap:2px;justify-content:center;';
    rowDefs.forEach(function (bd) {
      var btn = document.createElement('button');
      btn.id = bd.id;
      btn.textContent = bd.text;
      btn.style.cssText = btnRBase + 'flex:1;';
      btn.addEventListener('click', bd.handler);
      rowDiv.appendChild(btn);
    });
    btnRowContainer.appendChild(rowDiv);
  });

  panel.appendChild(btnRowContainer);

  document.body.appendChild(panel);

  this.__syncCombatVisState();

  this.__enableLockableDrag(panel, 'equip', { onDragStart: function () {}, onDragEnd: function () {} });
};

MobileFullscreen.prototype.__syncCombatVisState = function () {
  var sel = gameClient && gameClient.interface && gameClient.interface.fightModeSelector;
  if (!sel) return;

  var setActive = function (b, isActive) {
    b.style.backgroundPosition = isActive ? '0 -20px' : '0 0';
  };

  // Fight mode
  var fightBtns = document.querySelectorAll('#mobile-combat-modes .mobile-fight-btn');
  fightBtns.forEach(function (b) {
    setActive(b, parseInt(b.getAttribute('data-fight'), 10) === sel.currentFightMode);
  });

  // Chase mode
  var chaseBtns = document.querySelectorAll('#mobile-combat-modes .mobile-chase-btn');
  chaseBtns.forEach(function (b) {
    setActive(b, parseInt(b.getAttribute('data-chase'), 10) === sel.currentChaseMode);
  });

  // Safe fight
  var sfBtn = document.querySelector('#mobile-combat-modes .mobile-safefight-btn');
  if (sfBtn) {
    setActive(sfBtn, !!sel.__safeFight);
  }
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
