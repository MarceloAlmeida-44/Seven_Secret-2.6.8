const LIMITS = Object.freeze({ eyebrow: 120, title: 180, subtitle: 500, buttonText: 80, buttonUrl: 500, imageAlt: 180, caption: 180 });

function safeButtonUrl(value) {
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/.test(value)) return false;
  if (value.startsWith('#')) return value.length > 1;
  if (value.startsWith('/')) return !value.startsWith('//');
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function validateBanner(body = {}) {
  const labels = { eyebrow: 'Chamada', title: 'Título', subtitle: 'Subtítulo', buttonText: 'Texto do botão', buttonUrl: 'Destino do botão', imageAlt: 'Descrição da imagem', caption: 'Legenda' };
  const banner = {};
  for (const [key, max] of Object.entries(LIMITS)) {
    if (body[key] !== undefined && typeof body[key] !== 'string') throw new Error(labels[key] + ': valor inválido.');
    const value = (body[key] || '').replace(/\r\n?/g, '\n').trim();
    if (value.length > max) throw new Error(labels[key] + ': use até ' + max + ' caracteres.');
    const controls = key === 'title' || key === 'subtitle' ? /[\u0000-\u0009\u000b-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if (controls.test(value)) throw new Error(labels[key] + ': contém caracteres inválidos.');
    banner[key] = value;
  }
  for (const key of ['title', 'subtitle', 'buttonText', 'buttonUrl']) {
    if (!banner[key]) throw new Error('Preencha ' + labels[key].toLowerCase() + '.');
  }
  if (banner.title.split('\n').length > 2) throw new Error('O título deve ter no máximo duas linhas.');
  if (!safeButtonUrl(banner.buttonUrl)) throw new Error('Use uma âncora (#produtos), um caminho da loja (/produto/1) ou um endereço HTTPS válido no botão.');
  return banner;
}

module.exports = { LIMITS, safeButtonUrl, validateBanner };
