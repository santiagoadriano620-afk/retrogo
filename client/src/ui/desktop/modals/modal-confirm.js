const ConfirmModal = function(element) {

  /*
   * Class ConfirmModal
   * Modal that pops up to ask for a confirmation and apply a callback if succesful
   */

  // Inherit from modal
  Modal.call(this, element);

  this.__confirmCallback = Function.prototype;

}

ConfirmModal.prototype = Object.create(Modal.prototype);
ConfirmModal.constructor = ConfirmModal;

ConfirmModal.prototype.handleOpen = function(options) {

  /*
   * Function ConfirmModal.handleOpen
   * Accepts either a callback function or an object { title, message, callback }
   * Updates the modal header and body text if provided
   */

  var header = this.element.querySelector(".modal-header");
  var body = this.element.querySelector(".modal-body > div");

  if (typeof options === "function") {
    this.__confirmCallback = options;
    if (header) header.textContent = "Confirm?";
    if (body) body.textContent = "Are you sure?";
    return;
  }

  if (options.title && header) header.textContent = options.title;
  if (options.message && body) body.textContent = options.message;
  this.__confirmCallback = options.callback || Function.prototype;

}

ConfirmModal.prototype.handleConfirm = function() {

  /*
   * Function ConfirmModal.handleConfirm
   * Callback fired when confirm action is pressed
   */

  // Apply and reset the callback
  this.__confirmCallback();
  this.__confirmCallback = Function.prototype;

  return true;

}
