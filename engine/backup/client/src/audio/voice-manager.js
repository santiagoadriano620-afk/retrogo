const VoiceManager = function () {
  this.__enabled = false;
  this.__recording = false;
  this.__stream = null;
  this.__recorder = null;
  this.__audioCtx = null;
  this.__incoming = {};
  this.__isSpeaking = false;
}

VoiceManager.prototype.requestMic = function () {
  if (this.__stream) return Promise.resolve();
  return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
    this.__stream = stream;
  }.bind(this));
}

VoiceManager.prototype.startRecording = function () {
  if (this.__recording) return;
  if (!this.__stream) return;
  this.__recorder = new MediaRecorder(this.__stream, { mimeType: "audio/webm;codecs=opus" });
  this.__recorder.ondataavailable = this.__handleData.bind(this);
  this.__recorder.start(100);
  this.__recording = true;
}

VoiceManager.prototype.stopRecording = function () {
  if (!this.__recording) return;
  this.__recorder.stop();
  this.__recording = false;
}

VoiceManager.prototype.__handleData = function (event) {
  if (event.data.size === 0) return;
  var reader = new FileReader();
  reader.onload = function () {
    var buffer = reader.result;
    gameClient.send(new VoiceDataPacket(new Uint8Array(buffer)));
  };
  reader.readAsArrayBuffer(event.data);
}

VoiceManager.prototype.playAudio = function (name, data) {
  if (!this.__audioCtx) {
    this.__audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  var ctx = this.__audioCtx;
  ctx.decodeAudioData(data.buffer, function (audioBuffer) {
    var source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  });
}

VoiceManager.prototype.toggleVoiceMode = function () {
  if (this.__enabled) {
    this.disable();
  } else {
    this.enable();
  }
}

VoiceManager.prototype.enable = function () {
  var self = this;
  return this.requestMic().then(function () {
    self.__enabled = true;
  }).catch(function (err) {
    gameClient.interface.setCancelMessage("Microphone access denied.");
  });
}

VoiceManager.prototype.disable = function () {
  this.stopRecording();
  this.__enabled = false;
}

VoiceManager.prototype.isEnabled = function () {
  return this.__enabled;
}

VoiceManager.prototype.isRecording = function () {
  return this.__recording;
}
