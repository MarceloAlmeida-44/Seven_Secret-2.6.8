const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { once } = require('events');
const express = require('express');
const { defaultBanner } = require('../db/banner');
const { validateBanner, safeButtonUrl } = require('../lib/banner-validation');

test('destinos do botão aceitam navegação da loja e rejeitam protocolos perigosos', () => {
  for (const url of ['#produtos', '/produto/1', '/', 'https://example.com/colecao']) assert.equal(safeButtonUrl(url), true, url);
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/\\example.com', 'https://user:pass@example.com', 'http://example.com', '#', '/com espaco']) assert.equal(safeButtonUrl(url), false, url);
});

test('valida campos, comprimentos e as duas linhas do título', () => {
  assert.equal(validateBanner(defaultBanner).title, defaultBanner.title);
  assert.throws(() => validateBanner({ ...defaultBanner, title: 'A\nB\nC' }));
  assert.throws(() => validateBanner({ ...defaultBanner, title: 'x'.repeat(181) }));
  assert.throws(() => validateBanner({ ...defaultBanner, subtitle: {} }));
  assert.throws(() => validateBanner({ ...defaultBanner, buttonText: '' }));
  assert.throws(() => validateBanner({ ...defaultBanner, buttonUrl: 'javascript:alert(1)' }));
  assert.equal(validateBanner({ ...defaultBanner, eyebrow: '', caption: '', imageAlt: '' }).caption, '');
});

// Servidor isolado: dados de banner, autenticação e arquivos ficam em memória.
// Nenhuma consulta, upload ou alteração atinge o banco ou public/img reais.
async function fixture() {
  const root = path.resolve(__dirname, '..');
  const auth = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'middlewares/authMiddleware.js'), 'utf8'), {
    module: auth, process: { env: { ADMIN_EMAILS: 'admin@example.invalid' } }
  });
  let stored = { ...defaultBanner }, failSave = false, server;
  const uploads = new Map();
  const banner = {
    getBanner: async () => ({ ...stored }),
    saveBanner: async value => {
      if (failSave) throw new Error('test database failure');
      stored = { ...value };
      return { ...stored };
    }
  };
  const factory = Object.assign(() => {
    const app = express();
    const listen = app.listen.bind(app);
    app.listen = () => { server = listen(0, '127.0.0.1'); return server; };
    return app;
  }, express);
  const requireFixture = name => {
    if (name === 'express') return factory;
    if (name === 'dotenv') return { config() {} };
    if (name === './middlewares/authMiddleware') return auth.exports;
    if (name === './middlewares/loadUser') return () => (req, res, next) => {
      const role = req.get('x-test-role');
      req.currentUser = role ? { id: role, nome: role, email: role === 'admin' ? 'admin@example.invalid' : 'cliente@example.invalid' } : null;
      next();
    };
    if (name === './middlewares/logMiddleware') return (req, res, next) => next();
    if (name === './db/banner') return banner;
    if (name === './db/pool') return { pool: {}, products: async () => [] };
    if (name === 'fs') return {
      mkdirSync() {},
      promises: {
        writeFile: async (filename, buffer) => uploads.set(filename, buffer),
        rm: async filename => uploads.delete(filename)
      }
    };
    return require(name.startsWith('./') ? path.join(root, name) : name);
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), {
    require: requireFixture, __dirname: root, module: { exports: {} },
    process: { env: {} }, console: { log() {}, error() {} }, Buffer
  }, { filename: 'app.js' });
  await once(server, 'listening');
  return {
    url: 'http://127.0.0.1:' + server.address().port,
    uploads,
    fail() { failSave = true; },
    close: () => new Promise(resolve => server.close(resolve))
  };
}

test('API protege acesso, salva textos, preserva imagem e escapa a home', async () => {
  const app = await fixture();
  try {
    assert.equal((await fetch(app.url + '/api/admin/banner')).status, 401);
    assert.equal((await fetch(app.url + '/api/admin/banner', { headers: { 'x-test-role': 'cliente' } })).status, 403);
    assert.equal((await fetch(app.url + '/admin/banner/previa')).status, 401);
    const headers = { 'x-test-role': 'admin', 'Content-Type': 'application/json' };
    const invalid = await fetch(app.url + '/api/admin/banner', { method: 'PUT', headers, body: JSON.stringify({ ...defaultBanner, buttonUrl: 'javascript:alert(1)' }) });
    assert.equal(invalid.status, 400);
    const draft = { ...defaultBanner, title: '<script>alert(1)</script>', image: '/img/tentativa.png' };
    const response = await fetch(app.url + '/api/admin/banner', { method: 'PUT', headers, body: JSON.stringify(draft) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).banner.image, defaultBanner.image);
    const read = await fetch(app.url + '/api/admin/banner', { headers });
    assert.equal((await read.json()).banner.title, draft.title);
    assert.equal(app.uploads.size, 0);
    const html = await (await fetch(app.url + '/')).text();
    assert(html.includes('&lt;script&gt;'));
    assert(!html.includes('<script>alert(1)</script>'));
    assert.equal((html.match(/class="brand-hero"/g) || []).length, 1);
    assert.equal((await fetch(app.url + '/admin/banner/previa', { headers })).status, 200);
  } finally { await app.close(); }
});

test('upload rejeita arquivos inválidos e limpa novo arquivo se a gravação falhar', async () => {
  const app = await fixture();
  const headers = { 'x-test-role': 'admin' };
  const form = blob => {
    const body = new FormData();
    for (const [key, value] of Object.entries(validateBanner(defaultBanner))) body.append(key, value);
    body.append('imagem', blob, 'banner.png');
    return body;
  };
  try {
    const invalid = await fetch(app.url + '/api/admin/banner', { method: 'PUT', headers, body: form(new Blob(['fake'], { type: 'image/png' })) });
    assert.equal(invalid.status, 400);
    assert.equal(app.uploads.size, 0);
    const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
    const valid = await fetch(app.url + '/api/admin/banner', { method: 'PUT', headers, body: form(png) });
    assert.equal(valid.status, 200);
    assert.match((await valid.json()).banner.image, /^\/img\/banner-/);
    assert.equal(app.uploads.size, 1);
    app.fail();
    const failed = await fetch(app.url + '/api/admin/banner', { method: 'PUT', headers, body: form(png) });
    assert.equal(failed.status, 500);
    assert.equal(app.uploads.size, 1);
  } finally { await app.close(); }
});
