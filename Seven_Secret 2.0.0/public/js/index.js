document.addEventListener('DOMContentLoaded', async () => {
 const aviso = message => window.mostrarAviso ? window.mostrarAviso(message) : window.alert(message);
 let produtos;
 try {
  const response = await fetch('/api/produtos');
  if (!response.ok) throw Error('Não foi possível carregar o catálogo. Recarregue a página.');
  produtos = await response.json();
 } catch (err) { aviso(err.message); return; }
 document.addEventListener('click', event => {
  const button = event.target.closest('.add-to-bag[data-id]');
  if (!button || button.disabled) return;
  const produto = produtos.find(p => Number(p.id) === Number(button.dataset.id));
  if (!produto || Number(produto.estoque) <= 0) return;
  try {
   const parsed = JSON.parse(localStorage.getItem('carrinho') || '[]');
   const carrinho = Array.isArray(parsed) ? parsed : [];
   const index = carrinho.findIndex(p => Number(p.id) === Number(produto.id));
   const quantidade = (index >= 0 ? Number(carrinho[index].quantidade) || 1 : 0) + 1;
   if (quantidade > Number(produto.estoque)) return aviso('A quantidade disponível em estoque foi atingida.');
   const item = { ...produto, quantidade };
   if (index >= 0) carrinho[index] = item; else carrinho.push(item);
   localStorage.setItem('carrinho', JSON.stringify(carrinho));
   aviso(produto.nome + ' foi adicionado à sua sacola!');
  } catch (err) { aviso('Não foi possível salvar a sacola neste navegador.'); }
 });
 const grid = document.getElementById('catalog-grid');
 if (!grid) return;
 const count = document.getElementById('catalog-count'), empty = document.getElementById('catalog-empty');
 const cards = new Map(Array.from(grid.children).map(card => [Number(card.dataset.productId), card]));
 // Produtos criados depois da renderização aparecem ao recarregar a página.
 produtos = produtos.filter(p => cards.has(Number(p.id)));
 const normalize = v => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
 // A pesquisa global envia q pela URL, mesmo sem a antiga barra de filtros.
 const query = (new URLSearchParams(location.search).get('q') || '').trim();
 const term = normalize(query);
 const matchingIds = new Set(produtos.filter(p => !term ||
  normalize([p.nome,p.tipo,p.descricao,p.capacidade].join(' ')).includes(term)
 ).map(p => Number(p.id)));
 // Mantém a ordem renderizada pelo servidor, incluindo prioridade dos destaques.
 const selected = Array.from(cards).filter(([id]) => matchingIds.has(id)).map(([,card]) => card);
 grid.replaceChildren(...selected);
 count.textContent = selected.length + ' produto(s)' + (query ? ' para “' + query + '”' : '');
 empty.hidden = selected.length > 0;
 if (query && !location.hash) document.getElementById('produtos').scrollIntoView();
});
