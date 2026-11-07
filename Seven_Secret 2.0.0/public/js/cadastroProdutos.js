
const formProduto = document.getElementById('form-produto');
const listaProdutos = document.getElementById('lista-produtos');
const btnSalvar = document.getElementById('btn-salvar');
const inputImagem = document.getElementById('imagem');
const previewImagem = document.getElementById('preview-imagem');
const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'];
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
let urlPreview = null;

function limparPreview() {
  if (urlPreview) URL.revokeObjectURL(urlPreview);
  urlPreview = null;
  previewImagem.style.backgroundImage = '';
}

inputImagem.addEventListener('change', () => {
  const arquivo = inputImagem.files[0];
  limparPreview();
  if (!arquivo) return;
  if (!TIPOS_IMAGEM.includes(arquivo.type)) { inputImagem.value = ''; return alert('A imagem deve ser PNG, JPG ou WEBP.'); }
  if (arquivo.size > TAMANHO_MAXIMO) { inputImagem.value = ''; return alert('A imagem deve ter no máximo 10 MB.'); }
  urlPreview = URL.createObjectURL(arquivo);
  previewImagem.style.backgroundImage = `url("${urlPreview}")`;
});

// Mostra como a capacidade será salva ("Nome - 100ml"), igual ao que aparece na sacola.
const inputNome = document.getElementById('nome');
const dicaCapacidade = document.getElementById('dica-capacidade');
const TEXTO_PADRAO_DICA = dicaCapacidade.textContent;
function atualizarDicaCapacidade() {
  const ml = formProduto.querySelector('input[name="ml"]:checked');
  if (!ml) { dicaCapacidade.textContent = TEXTO_PADRAO_DICA; return; }
  const nome = inputNome.value.trim() || 'Nome do perfume';
  dicaCapacidade.replaceChildren(document.createTextNode('Será exibido como: '), criarElemento('strong', '', `${nome} - ${ml.value}`));
}
inputNome.addEventListener('input', atualizarDicaCapacidade);
formProduto.querySelectorAll('input[name="ml"]').forEach(r => r.addEventListener('change', atualizarDicaCapacidade));

const formatarDinheiro = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

async function chamarApi(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  const dados = await resposta.json();
  if (resposta.status === 401) { window.location.href = '/conta'; throw new Error(dados.erro); }
  if (!resposta.ok) throw new Error(dados.erro || 'Erro ao comunicar com o servidor.');
  return dados;
}

function criarElemento(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function desenharProduto(p) {
  const ativo = Boolean(p.ativo);
  const estoque = Number(p.estoque) || 0;
  const linha = criarElemento('div', 'produto-linha' + (ativo ? '' : ' inativo'));

  const img = criarElemento('div', 'produto-img');
  img.style.backgroundImage = `url("${encodeURI(p.imagem)}")`;

  const info = criarElemento('div', 'produto-info');
  const nome = criarElemento('span', 'produto-nome', p.nome);
  if (!ativo) nome.append(criarElemento('span', 'tag-inativo', 'Desativado'));
  info.append(nome, criarElemento('span', 'produto-tipo', `${p.tipo} · ${p.capacidade}`));

  const preco = criarElemento('div', 'produto-preco');
  if (p.desconto !== null) {
    preco.append(criarElemento('s', '', formatarDinheiro(p.preco)), document.createTextNode(formatarDinheiro(p.desconto)));
  } else {
    preco.textContent = formatarDinheiro(p.preco);
  }

  // Situação do estoque
  const classe = estoque === 0 ? 'zerado' : estoque <= 5 ? 'baixo' : 'ok';
  const texto = estoque === 0 ? 'Sem estoque' : estoque <= 5 ? `Estoque baixo · ${estoque}` : `Em estoque · ${estoque}`;
  const badge = criarElemento('span', `badge-estoque ${classe}`, texto);

  // Alterar a quantidade em estoque
  const controle = criarElemento('div', 'estoque-controle');
  const rotulo = criarElemento('label', '', 'Estoque');
  const campo = criarElemento('input');
  campo.type = 'number'; campo.min = '0'; campo.max = '99999'; campo.step = '1'; campo.value = String(estoque);
  campo.id = `estoque-${p.id}`; rotulo.htmlFor = campo.id;
  const salvar = criarElemento('button', 'btn-status btn-salvar-estoque', 'Salvar');
  salvar.type = 'button';
  const salvarEstoque = async () => {
    salvar.disabled = true;
    try {
      await chamarApi(`/api/admin/produtos/${p.id}/estoque`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estoque: campo.value }) });
      await carregarProdutos();
    } catch (erro) { alert(erro.message); salvar.disabled = false; }
  };
  salvar.addEventListener('click', salvarEstoque);
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); salvarEstoque(); } });
  controle.append(rotulo, campo, salvar);

  // Ativar / desativar o produto na loja
  const botao = criarElemento('button', 'btn-status btn-desativar', ativo ? 'Desativar' : 'Ativar');
  botao.type = 'button';
  botao.addEventListener('click', async () => {
    botao.disabled = true;
    try {
      await chamarApi(`/api/admin/produtos/${p.id}/ativo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !ativo }) });
      await carregarProdutos();
    } catch (erro) { alert(erro.message); botao.disabled = false; }
  });

  const acoes = criarElemento('div', 'produto-acoes');
  const destaque = criarElemento('button', 'btn-status', p.destaque ? 'Remover destaque' : 'Marcar destaque');
  destaque.type = 'button';
  destaque.setAttribute('aria-pressed', String(Boolean(p.destaque)));
  destaque.addEventListener('click', async () => {
    destaque.disabled = true;
    try {
      await chamarApi('/api/admin/produtos/' + p.id + '/destaque', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destaque: !p.destaque }) });
      await carregarProdutos();
    } catch (err) { alert(err.message); destaque.disabled = false; }
  });
  acoes.append(badge, controle, destaque, botao);

  linha.append(img, info, preco, acoes);
  return linha;
}

async function carregarProdutos() {
  try {
    const { produtos } = await chamarApi('/api/admin/produtos');
    listaProdutos.replaceChildren(...(produtos.length ? produtos.map(desenharProduto) : [criarElemento('div', 'lista-vazia', 'Nenhum produto cadastrado.')]));
  } catch (erro) {
    listaProdutos.replaceChildren(criarElemento('div', 'lista-vazia', erro.message));
  }
}

formProduto.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = new FormData();
  ['nome', 'tipo', 'preco', 'desconto', 'estoque', 'descricao'].forEach(campo => dados.append(campo, document.getElementById(campo).value.trim()));
  const ml = formProduto.querySelector('input[name="ml"]:checked');
  dados.append('ml', ml ? ml.value : '');
  dados.append('destaque', String(document.getElementById('destaque').checked));
  if (inputImagem.files[0]) dados.append('imagem', inputImagem.files[0]);

  btnSalvar.disabled = true;
  try {
    await chamarApi('/api/admin/produtos', { method: 'POST', body: dados });
    alert('Produto cadastrado!');
    formProduto.reset();
    limparPreview();
    atualizarDicaCapacidade();
    await carregarProdutos();
  } catch (erro) {
    alert(erro.message);
  } finally {
    btnSalvar.disabled = false;
  }
});

carregarProdutos();
