const SoundBit = function(ids) {

  /*
   * Class SoundBit
   * Wrapper for random soundbits of the same type
   */

  this.ids = ids;

}

SoundBit.prototype.play = function() {

  /*
   * Class SoundBit.play
   * Fully plays one of the soundbits
   */

  // Draw a random audio element from the pool and clone it
  let id = this.ids[Math.floor(Math.random() * this.ids.length)];
  let element = document.getElementById(id).cloneNode();

  // Set volume from the sound manager's master volume (scaled down 50% for soundbits)
  let masterVol = gameClient.interface.soundManager.__masterVolume;
  element.volume = masterVol * 0.5;
  element.play();

}