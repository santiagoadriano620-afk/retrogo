"use strict";

var PaymentModal = function (id) {
  Modal.call(this, id);
  this.__selectedPoints = 0;
  this.__stripe = null;
  this.__cardNumber = null;
  this.__cardExpiry = null;
  this.__cardCvc = null;
  this.__clientSecret = null;
  this.__processing = false;
  this.__init();
};

PaymentModal.prototype = Object.create(Modal.prototype);
PaymentModal.prototype.constructor = PaymentModal;

PaymentModal.prototype.__init = function () {
  var self = this;

  document.querySelectorAll(".payment-amount-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      self.__selectAmount(parseInt(this.getAttribute("data-points"), 10));
    });
  });

  document.getElementById("payment-pay-btn").addEventListener("click", function () {
    self.__handlePay();
  });

  document.getElementById("payment-cancel-btn").addEventListener("click", function () {
    self.handleCancel();
  });

  document.getElementById("payment-modal-close").addEventListener("click", function () {
    self.handleCancel();
  });
};

PaymentModal.prototype.handleOpen = function () {
  this.__selectedPoints = 0;
  this.__clientSecret = null;
  this.__processing = false;
  this.__resetUI();
  this.__loadStripe();
};

PaymentModal.prototype.handleCancel = function () {
  this.__destroyElements();
  gameClient.interface.modalManager.close();
};

PaymentModal.prototype.__resetUI = function () {
  document.querySelectorAll(".payment-amount-btn").forEach(function (btn) {
    btn.classList.remove("selected");
  });
  document.getElementById("payment-pay-btn").disabled = true;
  document.getElementById("payment-error").style.display = "none";
  document.getElementById("payment-error").textContent = "";
  document.getElementById("payment-loading").style.display = "none";
  document.getElementById("payment-loading").textContent = "";
};

PaymentModal.prototype.__selectAmount = function (points) {
  if (this.__processing) return;
  this.__selectedPoints = points;
  document.querySelectorAll(".payment-amount-btn").forEach(function (btn) {
    var pts = parseInt(btn.getAttribute("data-points"), 10);
    btn.classList.toggle("selected", pts === points);
  });
  document.getElementById("payment-pay-btn").disabled = false;
};

PaymentModal.prototype.__loadStripe = function () {
  var self = this;
  var baseUrl = window.location.origin;

  fetch(baseUrl + "/api/payments/config")
    .then(function (res) {
      if (!res.ok) throw new Error("Stripe not configured on server");
      return res.json();
    })
    .then(function (data) {
      self.__initStripe(data.publishableKey);
    })
    .catch(function (err) {
      self.__showError("Failed to load payment config: " + err.message);
    });
};

PaymentModal.prototype.__initStripe = function (publishableKey) {
  var self = this;

  if (window.Stripe) {
    self.__setupElements(publishableKey);
    return;
  }

  var script = document.createElement("script");
  script.src = "https://js.stripe.com/v3/";
  script.onload = function () {
    self.__setupElements(publishableKey);
  };
  script.onerror = function () {
    self.__showError("Failed to load Stripe.js. Check your connection.");
  };
  document.head.appendChild(script);
};

PaymentModal.prototype.__setupElements = function (publishableKey) {
  this.__stripe = Stripe(publishableKey);

  var elements = this.__stripe.elements({
    fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Source+Code+Pro" }]
  });

  var style = {
    base: {
      color: "#d3d3d3",
      fontFamily: '"Source Code Pro", monospace',
      fontSize: "15px",
      fontSmoothing: "antialiased",
      "::placeholder": { color: "#888" },
      "::selection": { backgroundColor: "#4a6fa5" },
      iconColor: "#d3d3d3"
    },
    invalid: {
      color: "#ff6b6b",
      iconColor: "#ff6b6b"
    }
  };

  this.__cardNumber = elements.create("cardNumber", { style: style });
  this.__cardNumber.mount("#payment-card-number");

  this.__cardExpiry = elements.create("cardExpiry", { style: style });
  this.__cardExpiry.mount("#payment-card-expiry");

  this.__cardCvc = elements.create("cardCvc", { style: style });
  this.__cardCvc.mount("#payment-card-cvc");
};

PaymentModal.prototype.__handlePay = function () {
  var self = this;

  if (this.__processing || !this.__selectedPoints || !this.__cardNumber) return;
  this.__processing = true;

  this.__showLoading("Creating payment...");
  document.getElementById("payment-pay-btn").disabled = true;

  var baseUrl = window.location.origin;
  var playerName = gameClient.player ? gameClient.player.name : "";

  fetch(baseUrl + "/api/payments/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points: this.__selectedPoints, playerName: playerName })
  })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error || "Failed to create payment"); });
      return res.json();
    })
    .then(function (data) {
      self.__clientSecret = data.clientSecret;
      self.__showLoading("Processing card...");
      return self.__stripe.confirmCardPayment(self.__clientSecret, {
        payment_method: {
          card: self.__cardNumber,
          billing_details: { name: playerName }
        }
      });
    })
    .then(function (result) {
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
        self.__onPaymentSuccess();
      } else {
        self.__onPaymentSuccess();
      }
    })
    .catch(function (err) {
      self.__showError(err.message || "Payment failed. Please try again.");
      self.__processing = false;
      document.getElementById("payment-pay-btn").disabled = false;
    });
};

PaymentModal.prototype.__onPaymentSuccess = function () {
  var self = this;

  this.__hideLoading();
  this.__showError("");

  var fields = document.getElementById("payment-card-fields");
  if (fields) fields.innerHTML = '<div style="text-align:center;color:#059669;font-size:16px;padding:24px 0;">✓ Payment Successful!</div>';

  setTimeout(function () {
    self.handleCancel();
    gameClient.send(new RequestPremiumBalancePacket());
    gameClient.interface.setCancelMessage("Premium Points credited! Check your balance.");
  }, 1500);
};

PaymentModal.prototype.__destroyElements = function () {
  [this.__cardNumber, this.__cardExpiry, this.__cardCvc].forEach(function (el) {
    if (el) { try { el.destroy(); } catch (e) {} }
  });
  this.__cardNumber = null;
  this.__cardExpiry = null;
  this.__cardCvc = null;
  this.__stripe = null;
  this.__clientSecret = null;
  this.__selectedPoints = 0;
  this.__processing = false;
};

PaymentModal.prototype.__showError = function (msg) {
  var el = document.getElementById("payment-error");
  if (el) {
    el.textContent = msg;
    el.style.display = msg ? "block" : "none";
  }
};

PaymentModal.prototype.__showLoading = function (msg) {
  var el = document.getElementById("payment-loading");
  if (el) {
    el.textContent = msg || "Processing...";
    el.style.display = "block";
  }
};

PaymentModal.prototype.__hideLoading = function () {
  var el = document.getElementById("payment-loading");
  if (el) el.style.display = "none";
};
