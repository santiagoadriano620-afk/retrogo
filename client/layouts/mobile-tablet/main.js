const MobileTabletLayout = {
  isActive: false,
  touchController: null,

  activate() {
    this.isActive = true;
  },

  deactivate() {
    this.isActive = false;
    if (this.touchController) {
      this.touchController.destroy();
      this.touchController = null;
    }
    this.__cleanupMobileUI();
  },

  initTouchController() {
    if (!this.touchController && window.TouchController) {
      this.touchController = new TouchController();
    }
  },

  getScale() {
    const canvas = document.getElementById('screen');
    if (!canvas) return 1;
    const rect = canvas.getBoundingClientRect();
    const internalWidth = canvas.width;
    return rect.width / internalWidth;
  },

  getScaledDimensions() {
    const canvas = document.getElementById('screen');
    if (!canvas) return { width: 680, height: 402, scale: 1 };
    const rect = canvas.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      scaleX: rect.width / canvas.width,
      scaleY: rect.height / canvas.height
    };
  },

  __cleanupMobileUI() {
    const mobileElements = [
      'mobile-status-bar', 'mobile-action-bar',
      'mobile-joystick-zone', 'mobile-hotbar', 'mobile-actions'
    ];
    mobileElements.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });

    document.querySelectorAll('.mobile-only').forEach(el => {
      el.style.display = 'none';
    });
  }
};
