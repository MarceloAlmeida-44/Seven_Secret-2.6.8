(() => {
  'use strict';
  const selector = '[data-image-upload] input[type="file"]';
  function sync(input) {
    const root = input?.closest('[data-image-upload]');
    const output = root?.querySelector('[data-upload-name]');
    if (!output) return;
    const file = input.files?.[0];
    output.textContent = file ? file.name : output.dataset.emptyText;
    output.title = file ? file.name : '';
    root.dataset.hasFile = String(Boolean(file));
  }
  window.SevenImageUpload = { sync };
  function init() {
    document.querySelectorAll(selector).forEach(sync);
    // Executa após a validação específica do banner/produto, que pode limpar o campo.
    document.addEventListener('change', event => {
      if (event.target.matches(selector)) sync(event.target);
    });
    document.addEventListener('reset', event => {
      const form = event.target;
      queueMicrotask(() => form.querySelectorAll(selector).forEach(sync));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
