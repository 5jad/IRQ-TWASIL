(function() {
  try {
    var raw = localStorage.getItem('tw.prefs.v1');
    if (raw) {
      var prefs = JSON.parse(raw);
      var theme = prefs.theme || 'system';
      if (theme === 'system') {
        var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = isDark ? 'dark' : 'light';
      }
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      document.documentElement.setAttribute('data-theme', theme);

      if (prefs.accent) {
        document.documentElement.setAttribute('data-accent', prefs.accent);
      }
      if (prefs.fontScale) {
        document.documentElement.style.setProperty('--font-scale', String(prefs.fontScale));
      }
      if (prefs.reduceMotion) {
        document.documentElement.classList.add('reduce-motion');
      }
    }
  } catch (e) {}
})();
