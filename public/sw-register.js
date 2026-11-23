var isCapacitorNative =
  typeof window !== 'undefined' &&
  window.Capacitor &&
  typeof window.Capacitor.isNativePlatform === 'function' &&
  window.Capacitor.isNativePlatform();

if (!isCapacitorNative && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  var isViteDev = !!document.querySelector('script[src*="/@vite/client"]');
  if (isViteDev) {
    Promise.all([
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        return Promise.all(regs.map(function(r) { return r.unregister(); }));
      }),
      window.caches ? caches.keys().then(function(keys) {
        return Promise.all(keys.map(function(k) { return caches.delete(k); }));
      }) : Promise.resolve()
    ]).then(function() {
      if (navigator.serviceWorker.controller && !sessionStorage.getItem('tw.dev.sw_cleaned')) {
        sessionStorage.setItem('tw.dev.sw_cleaned', '1');
        window.location.reload();
      }
    }).catch(function() {});
  } else {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function() {});
    });
  }
}
