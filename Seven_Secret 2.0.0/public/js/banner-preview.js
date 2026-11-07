(() => {
  'use strict';
  function init() {
    if (window.parent === window) return;
    const find = name => document.querySelector('[data-banner-' + name + ']');
    function reportSize() {
      const height = Math.max(1, Math.ceil(document.body.getBoundingClientRect().height));
      window.parent.postMessage({ type: 'seven-banner-preview-size', height }, location.origin);
    }
    function safeHref(value) {
      const v = String(value || '').trim();
      if (!v || /[\\\u0000-\u0020\u007f]/.test(v) || v.startsWith('//')) return null;
      if (v.startsWith('#')) return v.length > 1 ? v : null;
      if (v.startsWith('/')) return v;
      try {
        const u = new URL(v);
        return u.protocol === 'https:' && u.hostname && !u.username && !u.password ? u.href : null;
      } catch { return null; }
    }
    function safeImage(value) {
      const v = String(value || '').trim();
      if (!v || /[\\\u0000-\u0020\u007f]/.test(v) || v.startsWith('//')) return null;
      if (v.startsWith('/')) return v;
      try { const u = new URL(v); return u.protocol === 'blob:' && u.origin === location.origin ? v : null; }
      catch { return null; }
    }
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== window.parent || !event.data || event.data.type !== 'seven-banner-preview') return;
      const banner = event.data.banner;
      if (!banner || typeof banner !== 'object') return;
      for (const name of ['eyebrow', 'subtitle', 'caption']) {
        const node = find(name);
        if (node && typeof banner[name] === 'string') {
          node.textContent = banner[name];
          if (name !== 'subtitle') node.hidden = !banner[name].trim();
        }
      }
      const title = find('title');
      if (title && typeof banner.title === 'string') {
        const lines = banner.title.replace(/\r/g, '').split('\n').slice(0, 2);
        title.replaceChildren(document.createTextNode(lines[0]));
        if (lines.length > 1) {
          const emphasis = document.createElement('em');
          emphasis.textContent = lines[1];
          title.append(document.createElement('br'), emphasis);
        }
      }
      const button = find('button');
      const buttonText = find('button-text');
      if (buttonText && typeof banner.buttonText === 'string') buttonText.textContent = banner.buttonText;
      const href = safeHref(banner.buttonUrl);
      if (button && href) button.setAttribute('href', href);
      const image = find('image');
      const src = safeImage(banner.image);
      if (image) {
        if (src) image.setAttribute('src', src);
        if (typeof banner.imageAlt === 'string') {
          image.setAttribute('alt', banner.imageAlt);
          const artwork = image.closest('.hero-art');
          if (artwork) {
            if (banner.imageAlt.trim()) artwork.removeAttribute('aria-hidden');
            else artwork.setAttribute('aria-hidden', 'true');
          }
        }
      }
      reportSize();
    });
    document.addEventListener('click', event => {
      if (event.target.closest('[data-banner-button]')) event.preventDefault();
    });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(reportSize);
      observer.observe(document.body);
    } else window.addEventListener('resize', reportSize);
    document.querySelectorAll('img').forEach(image => image.addEventListener('load', reportSize));
    if (document.fonts?.ready) document.fonts.ready.then(reportSize);
    window.parent.postMessage({ type: 'seven-banner-preview-ready' }, location.origin);
    reportSize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
