const LayoutManager = {
  activeLayout: 'desktop',

  init() {
    document.documentElement.dataset.layout = 'desktop';
    window.__layoutDetected = { layout: 'desktop' };
  },

  getActive() { return 'desktop'; },
  isActive(layout) { return layout === 'desktop'; },
  getBP() { return 'xl'; }
};
