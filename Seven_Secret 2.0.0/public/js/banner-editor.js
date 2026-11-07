(() => {
  'use strict';
  function init() {
    const root = document.getElementById('banner-editor');
    if (!root) return;
    const form = document.getElementById('banner-form');
    const fields = document.getElementById('banner-fields');
    const status = document.getElementById('banner-status');
    const retry = document.getElementById('banner-retry');
    const save = document.getElementById('banner-save');
    const fileInput = document.getElementById('banner-image');
    const keepImage = document.getElementById('banner-keep-image');
    const frame = document.getElementById('banner-preview');
    const stage = document.getElementById('banner-preview-stage');
    const names = ['eyebrow', 'title', 'subtitle', 'buttonText', 'buttonUrl', 'imageAlt', 'caption'];
    const requiredNames = ['title', 'subtitle', 'buttonText', 'buttonUrl'];
    let savedBanner = null, imageFile = null, imageUrl = null;
    let loaded = false, loading = false, saving = false;
    let previewWidth = 1440, previewHeight = 700;

    function setStatus(message, state = '') {
      status.textContent = message;
      status.dataset.state = state;
    }
    function safeButtonUrl(value) {
      const v = String(value || '').trim();
      if (!v || /[\\\u0000-\u0020\u007f]/.test(v) || v.startsWith('//')) return false;
      if (v.startsWith('#')) return v.length > 1;
      if (v.startsWith('/')) return true;
      try { const u = new URL(v); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; }
      catch { return false; }
    }
    function draft() {
      const banner = Object.fromEntries(names.map(name => [name, form.elements[name].value]));
      banner.image = imageUrl || savedBanner?.image || '';
      return banner;
    }
    function sendPreview() {
      if (loaded && frame.contentWindow) frame.contentWindow.postMessage({ type: 'seven-banner-preview', banner: draft() }, location.origin);
    }
    function sizePreview() {
      const scale = Math.min(1, Math.max(1, stage.clientWidth) / previewWidth);
      frame.style.width = previewWidth + 'px';
      frame.style.height = previewHeight + 'px';
      frame.style.transform = 'scale(' + scale + ')';
      stage.style.height = Math.ceil(previewHeight * scale) + 'px';
    }
    function clearImage(clearInput = true) {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = null;
      imageFile = null;
      if (clearInput) fileInput.value = '';
      window.SevenImageUpload?.sync(fileInput);
      fileInput.setCustomValidity('');
      keepImage.hidden = true;
    }
    function applyBanner(banner) {
      if (!banner || names.some(name => typeof banner[name] !== 'string') || typeof banner.image !== 'string') {
        throw new Error('A configuração recebida não é válida. Tente carregar novamente.');
      }
      savedBanner = banner;
      names.forEach(name => { form.elements[name].value = banner[name]; form.elements[name].setCustomValidity(''); });
      clearImage();
    }
    async function request(options) {
      const response = await fetch('/api/admin/banner', { credentials: 'same-origin', cache: 'no-store', ...options });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        loaded = false; fields.disabled = true;
        setStatus('Sua sessão terminou. Entre novamente para editar o banner.', 'error');
        window.location.assign('/conta');
        throw new Error('Entre novamente na sua conta.');
      }
      if (response.status === 403) {
        loaded = false; fields.disabled = true;
        throw new Error('Sua conta não tem permissão para editar o banner.');
      }
      if (!response.ok) throw new Error(data.erro || 'Não foi possível comunicar com o servidor.');
      return data;
    }
    async function loadBanner() {
      if (loading || saving) return;
      loading = true; loaded = false; fields.disabled = true; retry.hidden = true;
      setStatus('Carregando configuração do banner...');
      try {
        const data = await request();
        applyBanner(data.banner);
        loaded = true; fields.disabled = false;
        setStatus('Banner carregado. Confira a prévia e salve para publicar alterações.');
        sendPreview();
      } catch (err) {
        setStatus(err.message || 'Não foi possível carregar o banner.', 'error');
        retry.hidden = false;
      } finally { loading = false; sizePreview(); }
    }
    function validateText() {
      names.forEach(name => form.elements[name].setCustomValidity(''));
      requiredNames.forEach(name => {
        if (!form.elements[name].value.trim()) form.elements[name].setCustomValidity('Preencha este campo.');
      });
      if (form.elements.title.value.replace(/\r/g, '').split('\n').length > 2) {
        form.elements.title.setCustomValidity('O título deve ter no máximo duas linhas.');
      }
      if (!safeButtonUrl(form.elements.buttonUrl.value)) {
        form.elements.buttonUrl.setCustomValidity('Use #ancora, /caminho local ou um endereço HTTPS sem usuário e senha.');
      }
    }
    names.forEach(name => form.elements[name].addEventListener('input', () => {
      form.elements[name].setCustomValidity('');
      if (loaded && !saving) {
        sendPreview();
        if (!fileInput.validationMessage) setStatus('Prévia atualizada. Salve para publicar as alterações.');
      }
    }));
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      clearImage(false);
      if (!file) { sendPreview(); return; }
      const message = !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
        ? 'A imagem deve ser PNG, JPG ou WEBP.'
        : file.size > 10 * 1024 * 1024 ? 'A imagem deve ter no máximo 10 MB.' : '';
      if (message) {
        fileInput.value = '';
        fileInput.setCustomValidity(message);
        keepImage.hidden = false;
        setStatus(message + ' Escolha outro arquivo ou use a imagem salva.', 'error');
        sendPreview(); return;
      }
      imageFile = file;
      imageUrl = URL.createObjectURL(file);
      keepImage.hidden = false;
      setStatus('Nova imagem selecionada para a prévia. Salve para publicar.');
      sendPreview();
    });
    keepImage.addEventListener('click', () => {
      clearImage(); sendPreview();
      setStatus('A imagem salva será mantida. Salve para publicar outras alterações.');
    });
    frame.addEventListener('load', () => { sizePreview(); sendPreview(); });
    window.addEventListener('message', event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'seven-banner-preview-ready') sendPreview();
      if (event.data.type === 'seven-banner-preview-size') {
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 1 && height <= 5000) { previewHeight = height; sizePreview(); }
      }
    });
    root.querySelectorAll('[data-banner-viewport]').forEach(button => button.addEventListener('click', () => {
      const width = Number(button.dataset.bannerViewport);
      if (![390, 1440].includes(width)) return;
      previewWidth = width;
      root.querySelectorAll('[data-banner-viewport]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      sizePreview(); sendPreview();
    }));
    if (window.ResizeObserver) new ResizeObserver(sizePreview).observe(stage);
    else window.addEventListener('resize', sizePreview);
    retry.addEventListener('click', loadBanner);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!loaded || saving) return;
      validateText();
      if (!form.reportValidity()) return;
      const body = new FormData();
      names.forEach(name => body.append(name, form.elements[name].value.trim()));
      if (imageFile) body.append('imagem', imageFile);
      saving = true; fields.disabled = true; save.textContent = 'Salvando banner...';
      setStatus('Salvando e publicando o banner...');
      try {
        const data = await request({ method: 'PUT', body });
        applyBanner(data.banner);
        sendPreview();
        setStatus('Banner salvo e publicado na página inicial.', 'success');
      } catch (err) { setStatus(err.message || 'Não foi possível salvar o banner.', 'error'); }
      finally { saving = false; fields.disabled = !loaded; save.textContent = 'Salvar e publicar banner'; }
    });
    window.addEventListener('pagehide', () => { if (imageUrl) URL.revokeObjectURL(imageUrl); });
    sizePreview(); loadBanner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
