"use strict";

(function () {

  let strings = {};

  function resolveNestedKey(obj, key) {
    if (obj && obj.hasOwnProperty(key)) {
      return obj[key];
    }
    return key.split(".").reduce(function (acc, part) {
      return acc && acc[part] !== undefined ? acc[part] : null;
    }, obj);
  }

  function lookup(key) {
    let val = resolveNestedKey(strings, key);
    if (val !== null) return val;
    return key;
  }

  window.__ = function (key) {
    let str = lookup(key);
    if (arguments.length > 1) {
      let args = Array.prototype.slice.call(arguments, 1);
      args.forEach(function (arg) {
        str = str.replace(/%s/, String(arg));
      });
    }
    return str;
  };

  window.__n = function (key, count) {
    let str = lookup(key);
    if (typeof str === "object") {
      str = count === 1 ? str.one : str.other;
    }
    str = str.replace(/%d/, String(count));
    if (arguments.length > 2) {
      let args = Array.prototype.slice.call(arguments, 2);
      args.forEach(function (arg) {
        str = str.replace(/%s/, String(arg));
      });
    }
    return str;
  };

  window.__locale = function () {
    return "en";
  };

  function applyDataI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var attr = el.getAttribute("data-i18n-attr");
      if (attr) {
        el.setAttribute(attr, window.__(key));
      } else {
        el.textContent = window.__(key);
      }
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute("placeholder", window.__(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", window.__(el.getAttribute("data-i18n-title")));
    });
  }

  function loadLocale(locale, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "src/i18n/" + locale + ".json", true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        callback(null, JSON.parse(xhr.responseText));
      } else {
        callback(new Error("Failed to load " + locale));
      }
    };
    xhr.onerror = function () {
      callback(new Error("Network error loading " + locale));
    };
    xhr.send();
  }

  window.__initI18n = function () {
    loadLocale("en", function (err, data) {
      if (!err) {
        strings = data && data.strings ? data.strings : {};
        applyDataI18n();
      }
    });
  };

})();
