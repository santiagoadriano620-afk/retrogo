const DesktopLayout = {
  isActive: false,

  activate() {
    this.isActive = true;
    DesktopFullscreen.init();
    document.getElementById('fullscreen-button').addEventListener('click', DesktopFullscreen.toggle);
  },

  deactivate() {
    this.isActive = false;
  },

  getScale() {
    const scaleX = (window.visualViewport.width - 350) / 1080;
    const scaleY = (window.visualViewport.height - 188) / 482;
    return Math.max(1, Math.min(scaleX, scaleY));
  },

  getScaledDimensions() {
    const baseScale = this.getScale();
    return {
      width: 1080 * baseScale,
      height: 482 * baseScale,
      scale: baseScale
    };
  }
};
