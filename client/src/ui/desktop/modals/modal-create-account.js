const CreateAccountModal = function(element) {

  /*
   * Class CreateAccountModal
   * Modal that pops up to ask for a confirmation and apply a callback if succesful
   */

  // Inherit from modal
  Modal.call(this, element);

}

CreateAccountModal.prototype = Object.create(Modal.prototype);
CreateAccountModal.constructor = CreateAccountModal;

CreateAccountModal.prototype.__isValidSubmission = function(options) {

  document.getElementById("create-username").style.border = null;
  document.getElementById("create-password").style.border = null;
  document.getElementById("create-password-repeat").style.border = null;
  document.getElementById("create-email").style.border = null;

  if(options.account === "" || options.password === "" || options.passwordRepeat === "" || options.email === "") {
    return false;
  }

  if(options.account.length < 6) {
    document.getElementById("create-username").style.border = "1px solid red";
    return false;
  }

  if(options.password.length < 6) {
    document.getElementById("create-password").style.border = "1px solid red";
    return false;
  }

  if(options.password !== options.passwordRepeat) {
    document.getElementById("create-password").style.border = "1px solid red";
    document.getElementById("create-password-repeat").style.border = "1px solid red";
    return false;
  }

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email)) {
    document.getElementById("create-email").style.border = "1px solid red";
    return false;
  }

  return true;

}

CreateAccountModal.prototype.handleConfirm = function() {

  /*
   * Function CreateAccountModal.handleConfirm
   * Callback fired when confirm action is pressed
   */

  let options = new Object({
    "account": document.getElementById("create-username").value,
    "password": document.getElementById("create-password").value,
    "passwordRepeat": document.getElementById("create-password-repeat").value,
    "email": document.getElementById("create-email").value
  });


  if(!this.__isValidSubmission(options)) {
    return false;
  }

  gameClient.networkManager.createAccount(options);
  return true;

}
