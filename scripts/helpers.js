(function(){
  'use strict';
  window.AppHelpers = window.AppHelpers || {};

  // Simple namespaced localStorage helpers
  const NS = 'breezechats';
  const safe = (fn, fallback) => { try { return fn(); } catch(e){ return fallback; } };

  window.AppHelpers.save = function(key, value){
    return safe(function(){
      localStorage.setItem(NS + ':' + key, JSON.stringify(value));
      return true;
    }, false);
  };

  window.AppHelpers.load = function(key, defaultValue){
    return safe(function(){
      const raw = localStorage.getItem(NS + ':' + key);
      return raw ? JSON.parse(raw) : defaultValue;
    }, defaultValue);
  };

  window.AppHelpers.uid = function(){
    return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  };

  window.AppHelpers.scrollToBottom = function($el){
    try {
      const el = $el && $el[0];
      if (el) el.scrollTop = el.scrollHeight;
    } catch(e){ /* ignore */ }
  };

  window.AppHelpers.isNearBottom = function($el, threshold){
    try {
      const el = $el && $el[0];
      if (!el) return true;
      const t = typeof threshold === 'number' ? threshold : 48;
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
      return distance <= t;
    } catch(e){ return true; }
  };

  window.AppHelpers.nowTime = function(){
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  window.AppHelpers.trimmed = function(v){ return (v || '').replace(/\s+/g, ' ').trim(); };
})();
