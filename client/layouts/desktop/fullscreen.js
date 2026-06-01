const DesktopFullscreen = {
  init() {
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, this.handleChange.bind(this));
    });
  },

  handleChange() {
    const wrapper = document.getElementById('canvas-id');
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement ||
                       document.mozFullScreenElement || document.msFullscreenElement;
    if (!wrapper) return;

    if (fsElement) {
      wrapper.__savedTransform = wrapper.style.transform || '';
      wrapper.__savedClipPath = wrapper.style.clipPath || '';
      wrapper.style.transform = 'none';
      wrapper.style.clipPath = 'none';
    } else {
      if (wrapper.__savedTransform !== undefined) {
        wrapper.style.transform = wrapper.__savedTransform;
        wrapper.style.clipPath = wrapper.__savedClipPath;
      }
    }
  },

  toggle() {
    const fsElement = document.fullscreenElement || document.webkitFullscreenElement ||
                       document.mozFullScreenElement || document.msFullscreenElement;
    if (fsElement) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                    document.mozCancelFullScreen || document.msExitFullscreen;
      if (exit) exit.call(document);
    } else {
      const el = document.body;
      const request = el.requestFullscreen || el.webkitRequestFullscreen ||
                       el.mozRequestFullScreen || el.msRequestFullscreen;
      if (request) request.call(el);
    }
  }
};
