require('dotenv').config();
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const logMiddleware = require('./middlewares/logMiddleware');
const loadUser = require('./middlewares/loadUser');
const { requireLogin, requireAdmin, isAdmin } = require('./middlewares/authMiddleware');
const errorMiddleware = require('./middlewares/errorMiddleware');

const app = express();

const PORT = Number(process.env.PORT || 8181);

const IMG = path.join(__dirname, 'public', 'img');
fs.mkdirSync(IMG, { recursive: true });
const { pool, products, allProducts, createProduct, setProductActive, setProductStock, getProduct, setProductFeatured } = require('./db/pool');
const { getPedido, listPedidos, savePedido, atualizarPedido } = require('./db/orders');
const { getBanner, saveBanner } = require('./db/banner');
const { validateBanner } = require('./lib/banner-validation');

const money = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}

function validPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex'), b = crypto.scryptSync(password, salt, 64);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function shipping(cep) {
  const digits = String(cep || '').replace(/\D/g, '');
  if (digits.length !== 8) throw new Error('Informe um CEP válido com 8 números.');
  const n = Number(digits.slice(0, 2));
  if (n >= 1 && n <= 19) return 22.50;
  if (n >= 20 && n <= 28) return 31.90;
  if (n >= 30 && n <= 39) return 28.00;
  if (n >= 80 && n <= 99) return 35.00;
  if (n >= 70 && n <= 76) return 38.50;
  return 49.90;
}

function emailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
}

// Envia os dados do pedido por e-mail (reaproveitado pelo cartão e pelo Pix) e retorna true/false
async function enviarEmailPedido(pedido) {
  const transport = emailTransport();
  if (!transport) return false;
  const pago = pedido.status === 'Pago';
  const itensHtml = pedido.itens.map(i => `<tr><td>${esc(i.nome)} ${esc(i.capacidade)}</td><td>${i.quantidade}</td><td>${money(i.total)}</td></tr>`).join('');
  const situacao = pago ? '<strong>Pagamento confirmado!</strong>' : '<strong>Pagamento ainda não confirmado.</strong>';
  const body = `<h1>Seven Secrets</h1><p>Olá, ${esc(pedido.nome)}!</p><p>Seu pedido <strong>${esc(pedido.numero)}</strong> foi ${pago ? 'pago com sucesso' : 'registrado'}. ${situacao}</p><table border="1" cellpadding="8"><tr><th>Produto</th><th>Qtd.</th><th>Total</th></tr>${itensHtml}</table><p>Subtotal: ${money(pedido.subtotal)}<br>Desconto: ${money(pedido.desconto)}<br>Frete: ${money(pedido.frete)}<br><strong>Total: ${money(pedido.total)}</strong></p><p>Pagamento selecionado: ${pedido.pagamento === 'pix' ? 'Pix' : 'Cartão'}</p><p>Entrega: ${esc(pedido.endereco.rua)}, ${esc(pedido.endereco.numero)} - ${esc(pedido.endereco.bairro)}, ${esc(pedido.endereco.cidade)}/${esc(pedido.endereco.estado)} - CEP ${esc(pedido.endereco.cep)}</p>`;
  try {
    await transport.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: pedido.email, subject: pago ? `Pedido ${pedido.numero} pago | Seven Secrets` : `Pedido ${pedido.numero} recebido | Seven Secrets`, html: body, text: pago ? `Pagamento do pedido ${pedido.numero} confirmado. Total: ${money(pedido.total)}.` : `Seu pedido ${pedido.numero} foi registrado. Pagamento ainda não confirmado. Total: ${money(pedido.total)}.` });
    return true;
  } catch (err) { console.error('Falha ao enviar e-mail:', err.message); return false; }
}

// Endereço que o celular precisa alcançar ao ler o QR Code (PUBLIC_URL tem prioridade).
function urlBase(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const host = req.get('host') || '', hostname = host.replace(/:\d+$/, '');
  if (host && !['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return `${req.protocol}://${host}`;
  const rede = Object.values(os.networkInterfaces()).flat().find(i => i && (i.family === 'IPv4' || i.family === 4) && !i.internal);
  return `http://${rede ? rede.address : 'localhost'}:${PORT}`;
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(logMiddleware);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'ALTERE_ESTA_CHAVE_NO_ENV', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 1000 * 60 * 60 * 12 } }));

function user(req) { return req.currentUser || null; }
// Carrega o usuário autenticado antes das rotas.
app.use(loadUser(pool));
// Disponibiliza o usuário autenticado para os templates EJS do cabeçalho.
app.use((req, res, next) => { res.locals.currentUser = req.currentUser || null; next(); });

const VOLUMES_ML = ['15ml', '30ml', '50ml', '70ml', '100ml'];

function validarEstoque(v) {
  const t = String(v ?? '').trim();
  const n = Number(t);
  if (t === '' || !Number.isInteger(n) || n < 0 || n > 99999) throw new Error('Informe um estoque válido (número inteiro de 0 a 99999).');
  return n;
}

function validarProduto(b = {}) {
  const texto = (v, max) => String(v ?? '').trim().slice(0, max);
  const valor = v => { const t = String(v ?? '').trim().replace(',', '.'); return t === '' ? null : Number(t); };
  const ml = texto(b.ml, 10).toLowerCase();
  const p = { nome: texto(b.nome, 160), tipo: texto(b.tipo, 120), descricao: texto(b.descricao, 2000), preco: valor(b.preco), desconto: valor(b.desconto) };

  if (!p.nome || !p.tipo || !p.descricao) throw new Error('Preencha nome, tipo e descrição.');
  if (!VOLUMES_ML.includes(ml)) throw new Error('Selecione o volume do perfume (15, 30, 50, 70 ou 100 ml).');
  // A capacidade continua no formato usado na sacola e no e-mail: "Nome - 100ml".
  p.capacidade = `${p.nome} - ${ml}`;
  p.estoque = validarEstoque(b.estoque);
  p.destaque = b.destaque === 'true';
  if (!Number.isFinite(p.preco) || p.preco <= 0 || p.preco > 99999999.99) throw new Error('Informe um preço válido.');
  if (p.desconto !== null && (!Number.isFinite(p.desconto) || p.desconto <= 0 || p.desconto >= p.preco)) throw new Error('O preço promocional deve ser maior que zero e menor que o preço.');
  p.preco = round(p.preco); if (p.desconto !== null) p.desconto = round(p.desconto);
  return p;
}

// Upload da imagem do produto: fica em memória, é conferida e só então salva em public/img.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 10 } }).single('imagem');

function uploadImagem(req, res, next) {
  upload(req, res, err => err ? res.status(400).json({ erro: err.code === 'LIMIT_FILE_SIZE' ? 'A imagem deve ter no máximo 10 MB.' : 'Não foi possível receber a imagem.' }) : next());
}

// Descobre o tipo pelos bytes do arquivo (não confia no nome nem no tipo enviados pelo navegador).
function extensaoImagem(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return '.png';
  if (buf.length > 12 && buf.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return '.jpg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
}

app.get('/', async (req, res, next) => {
  try {
    const [produtos, banner] = await Promise.all([products(), getBanner()]);
    res.render('index', { produtos, banner, busca: String(req.query.q || '') });
  } catch(e) { next(e); }
});

app.get('/api/admin/banner', requireAdmin, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try { res.json({ banner: await getBanner() }); } catch (err) { next(err); }
});

app.get('/admin/banner/previa', requireAdmin, async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  try { res.render('bannerPreview', { banner: await getBanner() }); } catch (err) { next(err); }
});

app.put('/api/admin/banner', requireAdmin, uploadImagem, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let banner, ext, uploadedPath;
  try {
    banner = validateBanner(req.body);
    if (req.file) {
      ext = extensaoImagem(req.file.buffer);
      if (!ext) throw new Error('A imagem do banner deve ser PNG, JPG ou WEBP.');
    }
  } catch (err) { return res.status(400).json({ erro: err.message }); }
  try {
    const current = await getBanner();
    banner.image = current.image;
    if (req.file) {
      const filename = 'banner-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext;
      uploadedPath = path.join(IMG, filename);
      await fs.promises.writeFile(uploadedPath, req.file.buffer);
      banner.image = '/img/' + filename;
    }
    res.json({ ok: true, banner: await saveBanner(banner) });
  } catch (err) {
    if (uploadedPath) await fs.promises.rm(uploadedPath, { force: true }).catch(() => {});
    console.error('Falha ao salvar banner:', err.message);
    res.status(500).json({ erro: 'Não foi possível salvar o banner. Verifique a configuração do banco e tente novamente.' });
  }
});

app.get('/produto/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const produto = Number.isSafeInteger(id) && id > 0 ? await getProduct(id) : null;
    if (!produto) return res.status(404).send('Produto não encontrado. <a href="/#produtos">Voltar ao catálogo</a>');
    res.render('produto', { produto });
  } catch (err) { next(err); }
});

app.put('/api/admin/produtos/:id/destaque', requireAdmin, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1 || typeof req.body.destaque !== 'boolean') return res.status(400).json({ erro: 'Dados inválidos.' });
  try {
    (await setProductFeatured(id, req.body.destaque)) ? res.json({ ok: true }) : res.status(404).json({ erro: 'Produto não encontrado.' });
  } catch (err) { next(err); }
});

app.get('/api/produtos', async (req, res, next) => { try { res.json(await products()); } catch(e) { next(e); } });
app.get('/api/produtos/busca', async (req, res, next) => { try { res.json(await products(req.query.q)); } catch(e) { next(e); } });

app.get('/cadastro', (req, res) => res.render('cadastro'));

app.get('/conta', (req, res) => { if (user(req)) return res.redirect('/editar-conta'); res.render('conta'); });

app.get('/editar-conta', (req, res) => { const u = user(req); u ? res.render('editar_conta', { admin: isAdmin(u) }) : res.redirect('/conta'); });

app.get('/sacola', async (req, res, next) => { try { res.render('sacola', { produtos: await products() }); } catch(e) { next(e); } });

app.get('/finalizar-compra', (req, res) => user(req) ? res.render('finalizarCompra') : res.redirect('/conta'));

app.get('/sem-produtos', (req, res) => res.render('semProdutos'));

app.get('/api/conta', (req, res) => { const u = user(req); res.json({ usuario: u ? { nome: u.nome, email: u.email, cpf: u.cpf, nascimento: u.nascimento } : null }); });

app.post('/api/cadastro', async (req, res, next) => {
  try {
    const { nome, cpf, email, senha, nascimento } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (String(nome || '').trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || String(senha || '').length < 8)
      return res.status(400).json({ erro: 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.' });
    const novo = { id: crypto.randomUUID(), nome: String(nome).trim(), cpf: String(cpf || ''), nascimento: String(nascimento || ''), email: cleanEmail, passwordHash: hashPassword(senha) };
    await pool.execute('INSERT INTO usuarios (id,nome,cpf,nascimento,email,password_hash) VALUES (?,?,?,?,?,?)', [novo.id,novo.nome,novo.cpf,novo.nascimento,novo.email,novo.passwordHash]);
    req.session.regenerate(err => { if (err) return next(err); req.session.userId = novo.id; res.json({ ok: true }); });
  } catch (err) { if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' }); next(err); }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id,email,password_hash AS passwordHash FROM usuarios WHERE email=?', [String(req.body.email || '').trim().toLowerCase()]);
    const u = rows[0];
    if (!u || !validPassword(String(req.body.senha || ''), u.passwordHash)) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
    req.session.regenerate(err => { if (err) return next(err); req.session.userId = u.id; res.json({ ok: true }); });
  } catch (err) { next(err); }
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.put('/api/conta', requireLogin, async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim(), email = String(req.body.email || '').trim().toLowerCase();
    if (nome.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'Nome ou e-mail inválido.' });
    let passwordHash = null;
    if (req.body.senha) {
      if (String(req.body.senha).length < 8) return res.status(400).json({ erro: 'A senha deve ter pelo menos 8 caracteres.' });
      passwordHash = hashPassword(String(req.body.senha));
    }
    await pool.execute('UPDATE usuarios SET nome=?,email=?,password_hash=COALESCE(?,password_hash) WHERE id=?', [nome,email,passwordHash,req.session.userId]);
    res.json({ ok: true });
  } catch (err) { if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'E-mail já cadastrado.' }); next(err); }
});

app.get('/api/pedidos', requireLogin, async (req, res, next) => {
  try { res.json({ pedidos: await listPedidos(req.session.userId) }); } catch (err) { next(err); }
});

app.post('/api/pedidos/confirmacao', requireLogin, async (req, res) => {
  try {

    const u = user(req), { carrinho, endereco, pagamento, cupom } = req.body || {};

    if (!Array.isArray(carrinho) || !carrinho.length || carrinho.length > 100) throw new Error('Sacola inválida ou vazia.');

    if (!endereco || ['cep', 'rua', 'numero', 'bairro', 'cidade', 'estado'].some(k => !String(endereco[k] || '').trim())) throw new Error('Preencha o endereço completo.');

    if (!['pix', 'cartao'].includes(pagamento)) throw new Error('Selecione uma forma de pagamento.');
    const catalog = await products(), itens = [];

    for (const item of carrinho) {
      const p = catalog.find(p => Number(p.id) === Number(item.id)), q = Number(item.quantidade);
      if (!p || !Number.isInteger(q) || q < 1 || q > 99) throw new Error('Produto ou quantidade inválidos.');
      if (Number(p.estoque) <= 0) throw new Error(`${p.nome} está sem estoque. Remova o item da sacola.`);
      if (q > Number(p.estoque)) throw new Error(`Só há ${p.estoque} unidade(s) de ${p.nome} em estoque.`);
      const unit = Number(p.desconto ?? p.preco);
      if (!Number.isFinite(unit) || unit < 0) throw new Error('Preço inválido no catálogo.');
      itens.push({ id: p.id, nome: p.nome, capacidade: p.capacidade, quantidade: q, precoUnitario: unit, total: round(unit * q) });
    }

    const subtotal = round(itens.reduce((s, i) => s + i.total, 0));

    const frete = shipping(endereco.cep);

    const desconto = ['SECRETS10', 'KWL28J'].includes(String(cupom || '').toUpperCase()) ? round(subtotal * 0.1) : 0;

    const total = round(subtotal + frete - desconto);

    const pedido = { numero: 'SS-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'), usuarioId: u.id, email: u.email, nome: u.nome, itens, subtotal, frete, desconto, total, pagamento, endereco, status: 'Aguardando pagamento', criadoEm: new Date().toISOString(), emailEnviado: false };

    // Pix: o e-mail só sai quando o pagamento for confirmado pelo QR Code (null = ainda não enviado).
    if (pagamento === 'pix') { pedido.pixToken = crypto.randomBytes(24).toString('hex'); pedido.emailEnviado = null; }

    await savePedido(pedido);

    if (pagamento !== 'pix') {

      pedido.emailEnviado = await enviarEmailPedido(pedido);

      await atualizarPedido(pedido.numero, { emailEnviado: pedido.emailEnviado });
    }

    res.status(201).json({ emailEnviado: pedido.emailEnviado, pedido: { numero: pedido.numero, total: pedido.total, status: pedido.status, email: pedido.email } });

  } catch (err) { res.status(400).json({ erro: err.message || 'Não foi possível registrar o pedido.' }); }
});

app.get('/pagamento-pix', async (req, res, next) => {
  try {
    const u = user(req);
    if (!u) return res.redirect('/conta');
    const pedido = await getPedido(String(req.query.pedido || ''), u.id, 'pix');
    if (!pedido) return res.redirect('/');
    const link = `${urlBase(req)}/pix/confirmar/${pedido.pixToken}`;
    const qrcode = await QRCode.toDataURL(link, { width: 320, margin: 1 });
    res.render('pagamentoPix', { pedido, qrcode, link });
  } catch (e) { next(e); }
});

app.get('/api/pedidos/:numero/status', requireLogin, async (req, res, next) => {
  try {
  const pedido = await getPedido(req.params.numero, req.session.userId);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  res.json({ status: pedido.status, emailEnviado: pedido.emailEnviado });
  } catch (err) { next(err); }
});

// Endereço lido pelo QR Code: marca o pedido como pago e envia os dados por e-mail.
app.get('/pix/confirmar/:token', async (req, res, next) => {
  try {
    let pedido = await getPedido(null, null, null, req.params.token);
    if (!pedido) return res.status(404).send('Pagamento não encontrado. <a href="/">Voltar para a loja</a>');

    if (pedido.status !== 'Pago') {
      pedido = await atualizarPedido(pedido.numero, { status: 'Pago', pagoEm: new Date().toISOString() });
      const enviado = await enviarEmailPedido(pedido);
      pedido = await atualizarPedido(pedido.numero, { emailEnviado: enviado });
    }

    res.render('pixConfirmado', { pedido });
  } catch (e) { next(e); }
});

app.get('/cadastro-produtos', (req, res) => { const u = user(req); if (!u) return res.redirect('/conta'); isAdmin(u) ? res.render('cadastroProdutos') : res.redirect('/'); });

app.get('/api/admin/produtos', requireAdmin, async (req, res) => {
  try { res.json({ produtos: await allProducts() }); }
  catch (err) { console.error(err.message); res.status(500).json({ erro: 'Não foi possível carregar os produtos.' }); }
});

app.post('/api/admin/produtos', requireAdmin, uploadImagem, async (req, res) => {
  let produto, ext;
  try {
    produto = validarProduto(req.body);
    if (!req.file) throw new Error('Envie a imagem do produto.');
    ext = extensaoImagem(req.file.buffer);
    if (!ext) throw new Error('A imagem deve ser um arquivo PNG, JPG ou WEBP.');
  } catch (err) { return res.status(400).json({ erro: err.message }); }

  const arquivo = `produto-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`, caminho = path.join(IMG, arquivo);
  try {
    fs.writeFileSync(caminho, req.file.buffer);
    produto.imagem = '/img/' + arquivo;
    res.status(201).json({ ok: true, id: await createProduct(produto) });
  } catch (err) { fs.rmSync(caminho, { force: true }); console.error(err.message); res.status(500).json({ erro: 'Não foi possível salvar o produto.' }); }
});

app.put('/api/admin/produtos/:id/ativo', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || typeof req.body.ativo !== 'boolean') return res.status(400).json({ erro: 'Dados inválidos.' });
  try { (await setProductActive(id, req.body.ativo)) ? res.json({ ok: true }) : res.status(404).json({ erro: 'Produto não encontrado.' }); }
  catch (err) { console.error(err.message); res.status(500).json({ erro: 'Não foi possível atualizar o produto.' }); }
});

app.put('/api/admin/produtos/:id/estoque', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ erro: 'Dados inválidos.' });
  try {
    const estoque = validarEstoque(req.body.estoque);
    (await setProductStock(id, estoque)) ? res.json({ ok: true, estoque }) : res.status(404).json({ erro: 'Produto não encontrado.' });
  } catch (err) {
    if (/estoque válido/.test(err.message)) return res.status(400).json({ erro: err.message });
    console.error(err.message); res.status(500).json({ erro: 'Não foi possível atualizar o estoque.' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ erro: 'Rota não encontrada.' });
  res.status(404).send('Página não encontrada. <a href="/">Voltar para a loja</a>');
});
app.use(errorMiddleware);
app.listen(PORT, () => console.log(`Seven Secrets: http://localhost:${PORT}`));
