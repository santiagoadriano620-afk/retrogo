const LayoutManager = {
  activeLayout: 'desktop',
  loadedOverlays: [],
  settings: { preferredLayout: null },

  init() {
    this.loadSettings();
    if (window.__layoutDetected) {
      this.activeLayout = window.__layoutDetected.layout;
    }
    window.addEventListener('resize', () => { this.__onResize(); });
    window.addEventListener('gamepadconnected', () => { this.__onGamepad(); });
  },

  __onResize() {
    if (this.activeLayout === 'tv') return;
    const layout = this.detect();
    if (layout !== this.activeLayout) {
      this.activeLayout = layout;
      this.__apply();
    }
  },

  __onGamepad() {
    if (window.innerWidth >= 1920 && this.activeLayout !== 'tv') {
      this.activeLayout = 'tv';
      this.__apply();
    }
  },

  __apply() {
    document.documentElement.dataset.layout = this.activeLayout;
    window.dispatchEvent(new CustomEvent('layoutchange', {
      detail: { layout: this.activeLayout, breakpoint: this.getBP() }
    }));
  },

  detect() {
    if (this.settings.preferredLayout) return this.settings.preferredLayout;
    const w = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();
    if (/tizen|webos|smart-tv|smarttv|netcast|viera|bravia|googletv|roku|firetv/i.test(ua)) return 'tv';
    if ((navigator.getGamepads ? Array.from(navigator.getGamepads()).some(g => g !== null) : false) && w >= 1920) return 'tv';
    return 'desktop';
  },

  getBP() {
    const w = window.innerWidth;
    if (w <= 480) return 'xs';
    if (w <= 768) return 'sm';
    if (w <= 1024) return 'md';
    if (w <= 1366) return 'lg';
    return 'xl';
  },

  getActive() { return this.activeLayout; },
  isActive(layout) { return this.activeLayout === layout; },

  setLayout(layout) {
    this.settings.preferredLayout = layout;
    this.saveSettings();
    this.activeLayout = layout;
    this.__apply();
  },

  resetAuto() {
    this.settings.preferredLayout = null;
    this.saveSettings();
    this.activeLayout = this.detect();
    this.__apply();
  },

  loadSettings() {
    try {
      const saved = localStorage.getItem('retrogo_layout');
      if (saved) this.settings = JSON.parse(saved);
    } catch (e) {}
  },

  saveSettings() {
    try { localStorage.setItem('retrogo_layout', JSON.stringify(this.settings)); } catch (e) {}
  }
};
