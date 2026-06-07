"use strict";

const StarterBoxModal = function (id) {
  Modal.call(this, id);
  this.__boxId = null;
  this.__containerWhich = null;
  this.__slotIndex = null;
  this.__data = null;
  this.__selectedChoices = {};
};

StarterBoxModal.prototype = Object.create(Modal.prototype);
StarterBoxModal.prototype.constructor = StarterBoxModal;

StarterBoxModal.prototype.__getGender = function () {
  if (!gameClient.player) return "male";
  var id = gameClient.player.outfit.id;
  if ((id >= 111 && id <= 117) || (id >= 126 && id <= 129)) return "male";
  return "female";
};

StarterBoxModal.prototype.handleOpen = function (options) {
  this.__boxId = options.boxId;
  this.__containerWhich = options.which;
  this.__slotIndex = options.index;
  this.__data = STARTER_BOX_DATA[this.__boxId];
  this.__selectedChoices = {};
  this.__render();
};

StarterBoxModal.prototype.__render = function () {
  var data = this.__data;
  if (!data) return;

  var el = this.element;
  el.querySelector(".modal-header").textContent = data.name;

  var body = el.querySelector(".modal-body");
  body.innerHTML = "";

  // Auto-grant section
  var autoSection = document.createElement("div");
  autoSection.className = "starter-box-section";
  var autoTitle = document.createElement("div");
  autoTitle.className = "starter-box-section-title";
  autoTitle.textContent = "You will receive:";
  autoSection.appendChild(autoTitle);
  data.autoGrant.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "starter-box-row starter-box-auto";
    row.textContent = item.label;
    autoSection.appendChild(row);
  });
  body.appendChild(autoSection);

  // Choice sections
  var self = this;
  data.choices.forEach(function (choice, ci) {
    self.__selectedChoices[ci] = [];
    var section = document.createElement("div");
    section.className = "starter-box-section";
    section.setAttribute("data-choice-index", ci);

    var title = document.createElement("div");
    title.className = "starter-box-section-title";
    title.textContent = choice.label;
    section.appendChild(title);

    var options = choice.options;
    if (choice.genderFilter) {
      var gender = self.__getGender();
      options = options.filter(function (opt) {
        if (gender === "male") return opt.id <= 65004;
        return opt.id >= 65005;
      });
    }

    if (choice.allowDuplicates) {
      self.__renderQuantityChoices(section, choice, options, ci);
    } else {
      self.__renderCheckboxChoices(section, choice, options, ci);
    }

    body.appendChild(section);
  });

  this.__updateConfirmButton();
};

StarterBoxModal.prototype.__renderCheckboxChoices = function (section, choice, options, ci) {
  var self = this;
  options.forEach(function (opt) {
    var row = document.createElement("div");
    row.className = "starter-box-row starter-box-selectable";

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "starter-box-checkbox";
    checkbox.setAttribute("data-choice-idx", ci);
    checkbox.setAttribute("data-opt-id", opt.id);

    var label = document.createElement("span");
    label.textContent = opt.name;

    row.appendChild(checkbox);
    row.appendChild(label);

    row.addEventListener("click", function (e) {
      if (e.target === checkbox) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });

    checkbox.addEventListener("change", function () {
      var selected = self.__selectedChoices[ci] || [];
      var existingIdx = selected.indexOf(opt.id);
      if (this.checked) {
        if (selected.length >= choice.max) {
          this.checked = false;
          return;
        }
        selected.push(opt.id);
      } else {
        if (existingIdx !== -1) selected.splice(existingIdx, 1);
      }
      self.__selectedChoices[ci] = selected;
      self.__updateConfirmButton();
    });

    section.appendChild(row);
  });
};

StarterBoxModal.prototype.__renderQuantityChoices = function (section, choice, options, ci) {
  var self = this;

  var totalDisplay = document.createElement("div");
  totalDisplay.className = "starter-box-total";
  totalDisplay.textContent = "Selected: 0 / " + choice.max;
  section.appendChild(totalDisplay);

  var counts = {};

  var refreshAllButtons = function () {
    var sel = self.__selectedChoices[ci] || [];
    var total = sel.length;
    totalDisplay.textContent = "Selected: " + total + " / " + choice.max;

    var allPlus = section.querySelectorAll(".starter-box-qty-plus");
    allPlus.forEach(function (btn) {
      btn.disabled = total >= choice.max;
    });

    options.forEach(function (opt, idx) {
      var c = counts[opt.id] || 0;
      var minusBtns = section.querySelectorAll(".starter-box-qty-minus");
      if (minusBtns[idx]) minusBtns[idx].disabled = c <= 0;
      var countSpans = section.querySelectorAll(".starter-box-qty-count");
      if (countSpans[idx]) countSpans[idx].textContent = c;
    });

    self.__updateConfirmButton();
  };

  options.forEach(function (opt) {
    counts[opt.id] = 0;

    var row = document.createElement("div");
    row.className = "starter-box-row starter-box-qty-row";

    var label = document.createElement("span");
    label.className = "starter-box-qty-label";
    label.textContent = opt.name;

    var controls = document.createElement("div");
    controls.className = "starter-box-qty-controls";

    var btnMinus = document.createElement("button");
    btnMinus.className = "starter-box-qty-btn starter-box-qty-minus";
    btnMinus.textContent = "−";
    btnMinus.disabled = true;

    var countSpan = document.createElement("span");
    countSpan.className = "starter-box-qty-count";
    countSpan.textContent = "0";

    var btnPlus = document.createElement("button");
    btnPlus.className = "starter-box-qty-btn starter-box-qty-plus";
    btnPlus.textContent = "+";

    btnPlus.addEventListener("click", function () {
      var sel = self.__selectedChoices[ci] || [];
      if (sel.length >= choice.max) return;
      counts[opt.id]++;
      sel.push(opt.id);
      self.__selectedChoices[ci] = sel;
      refreshAllButtons();
    });

    btnMinus.addEventListener("click", function () {
      var sel = self.__selectedChoices[ci] || [];
      if (counts[opt.id] <= 0) return;
      counts[opt.id]--;
      var idx = sel.lastIndexOf(opt.id);
      if (idx !== -1) sel.splice(idx, 1);
      self.__selectedChoices[ci] = sel;
      refreshAllButtons();
    });

    controls.appendChild(btnMinus);
    controls.appendChild(countSpan);
    controls.appendChild(btnPlus);
    row.appendChild(label);
    row.appendChild(controls);
    section.appendChild(row);
  });
};

StarterBoxModal.prototype.__updateConfirmButton = function () {
  var btn = this.element.querySelector("[action=confirm]");
  if (!btn) return;
  var allValid = true;
  var self = this;
  this.__data.choices.forEach(function (choice, ci) {
    var sel = self.__selectedChoices[ci] || [];
    if (sel.length < choice.max) allValid = false;
  });
  btn.disabled = !allValid;
};

StarterBoxModal.prototype.handleConfirm = function () {
  var choices = [];
  var self = this;
  this.__data.choices.forEach(function (choice, ci) {
    var sel = self.__selectedChoices[ci] || [];
    sel.forEach(function (id) {
      choices.push(id);
    });
  });

  gameClient.send(new StarterBoxChoicePacket(
    this.__containerWhich,
    this.__slotIndex,
    choices
  ));

  return true;
};
