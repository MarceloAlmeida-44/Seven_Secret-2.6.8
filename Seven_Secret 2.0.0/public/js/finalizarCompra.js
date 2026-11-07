// FORMATADOR E MÁSCARA DO CEP
const cepInput = document.getElementById('cep');
if (cepInput) {
  cepInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 5) value = value.replace(/^(\d{5})(\d)/, '$1-$2');
    e.target.value = value;
  });
}

// ELEMENTOS DE PAGAMENTO E BOTÕES
const paymentCards = document.querySelectorAll('.payment-card');
const inputPagamento = document.getElementById('forma-pagamento');
const btnFinalizar = document.getElementById('btn-finalizar');
const feedbackBox = document.getElementById('feedbackMensagem');

// Função de feedback acessível (Design Universal: Ícone + Prefixo + Texto)
function exibirFeedback(mensagem, tipo = 'erro') {
  if (!feedbackBox) return;
  feedbackBox.style.display = 'flex';
  feedbackBox.className = `feedback-box feedback-${tipo}`;
  
  const isErro = tipo === 'erro';
  const icone = isErro ? 'alert-triangle' : 'check-circle-2';
  const prefixo = isErro ? '✕ Erro:' : '✓ Sucesso:';

  feedbackBox.innerHTML = `
    <i data-lucide="${icone}" aria-hidden="true"></i>
    <span><strong>${prefixo}</strong> ${mensagem}</span>
  `;
  
  if (window.lucide) lucide.createIcons();
  feedbackBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limparFeedback() {
  if (!feedbackBox) return;
  feedbackBox.style.display = 'none';
  feedbackBox.innerHTML = '';
}

function textoBotaoFinalizar() {
  const isPix = inputPagamento ? inputPagamento.value === 'pix' : true;
  const texto = isPix ? 'Pagar com Pix' : 'Registrar pedido (pagamento pendente)';
  const icone = isPix ? 'qr-code' : 'credit-card';
  return `<i data-lucide="${icone}" aria-hidden="true"></i> ${texto}`;
}

function atualizarBotaoFinalizar() {
  if (btnFinalizar) {
    btnFinalizar.innerHTML = textoBotaoFinalizar();
    if (window.lucide) lucide.createIcons();
  }
}

atualizarBotaoFinalizar();

paymentCards.forEach(card => card.addEventListener('click', () => {
  paymentCards.forEach(c => {
    c.classList.remove('active');
    c.setAttribute('aria-checked', 'false');
  });
  card.classList.add('active');
  card.setAttribute('aria-checked', 'true');
  if (inputPagamento) inputPagamento.value = card.getAttribute('data-method');
  atualizarBotaoFinalizar();
}));

function lerJSONStorage(chave, padrao = null) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; }
  catch { return padrao; }
}

document.addEventListener('DOMContentLoaded', async () => {
  let endereco = lerJSONStorage('endereco_transicao_sacola', null);
  const cepSalvo = localStorage.getItem('cep_transicao_sacola');

  if (!endereco && cepSalvo) {
    endereco = { cep: cepSalvo };
  }

  if (endereco && (!endereco.rua || !endereco.cidade) && endereco.cep && typeof window.buscarCEP === 'function') {
    try {
      const dadosCEP = await window.buscarCEP(endereco.cep);
      endereco = {
        ...endereco,
        cep: dadosCEP.cep,
        rua: endereco.rua || dadosCEP.logradouro,
        complemento: endereco.complemento || dadosCEP.complemento,
        bairro: endereco.bairro || dadosCEP.bairro,
        cidade: endereco.cidade || dadosCEP.cidade,
        estado: endereco.estado || dadosCEP.uf
      };
      localStorage.setItem('endereco_transicao_sacola', JSON.stringify(endereco));
      localStorage.setItem('cep_transicao_sacola', dadosCEP.cep);
    } catch (erro) {
      console.warn('Não foi possível preencher o endereço automaticamente:', erro.message);
    }
  }

  ['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'estado'].forEach(campo => {
    const el = document.getElementById(campo);
    if (el && endereco && endereco[campo] && !el.value) el.value = endereco[campo];
  });

  const totalSalvo = Number(localStorage.getItem('total_sacola') || 0);
  const elTextoTotal = document.getElementById('texto-total-checkout');
  if (elTextoTotal) {
    elTextoTotal.innerText = `Total a pagar: ${totalSalvo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  }
});

// CONSULTA DE CEP NO CHECKOUT
if (cepInput) {
  cepInput.addEventListener('blur', async () => {
    const cep = cepInput.value.replace(/\D/g, '');
    if (cep.length !== 8 || typeof window.buscarCEP !== 'function') return;

    try {
      limparFeedback();
      const dados = await window.buscarCEP(cep);
      const valores = {
        rua: dados.logradouro,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.uf
      };
      Object.entries(valores).forEach(([id, valor]) => {
        const campo = document.getElementById(id);
        if (campo && !campo.value.trim()) campo.value = valor;
      });
    } catch (erro) {
      exibirFeedback(erro.message || 'Não foi possível consultar esse CEP.', 'erro');
    }
  });
}

// SUBMISSÃO DO FORMULÁRIO DE ENTREGA
const formEntrega = document.getElementById('form-entrega');
if (formEntrega) {
  formEntrega.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparFeedback();

    if (!inputPagamento || !inputPagamento.value) {
      return exibirFeedback('Por favor, selecione uma forma de pagamento.', 'erro');
    }

    // VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS DO ENDEREÇO
    const cepEl = document.getElementById('cep');
    const numeroEl = document.getElementById('numero');
    const ruaEl = document.getElementById('rua');
    const bairroEl = document.getElementById('bairro');
    const cidadeEl = document.getElementById('cidade');
    const estadoEl = document.getElementById('estado');

    if (!cepEl || cepEl.value.replace(/\D/g, '').length !== 8) {
      cepEl.focus();
      return exibirFeedback('Informe um CEP válido contendo 8 números.', 'erro');
    }
    if (!numeroEl || !numeroEl.value.trim()) {
      numeroEl.focus();
      return exibirFeedback('Por favor, informe o número da sua residência.', 'erro');
    }
    if (!ruaEl || !ruaEl.value.trim()) {
      ruaEl.focus();
      return exibirFeedback('Por favor, informe o nome da rua ou avenida.', 'erro');
    }
    if (!bairroEl || !bairroEl.value.trim()) {
      bairroEl.focus();
      return exibirFeedback('Por favor, informe o bairro para entrega.', 'erro');
    }
    if (!cidadeEl || !cidadeEl.value.trim()) {
      cidadeEl.focus();
      return exibirFeedback('Por favor, informe a cidade.', 'erro');
    }
    if (!estadoEl || !estadoEl.value.trim()) {
      estadoEl.focus();
      return exibirFeedback('Por favor, informe a sigla do Estado (UF).', 'erro');
    }

    const carrinho = lerJSONStorage('carrinho', []);
    if (!Array.isArray(carrinho) || carrinho.length === 0) {
      exibirFeedback('Sua sacola está vazia! Redirecionando...', 'erro');
      setTimeout(() => { window.location.href = '/sacola'; }, 1500);
      return;
    }

    const btn = document.getElementById('btn-finalizar');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Enviando pedido...`;
      if (window.lucide) lucide.createIcons();
    }

    const pedido = {
      carrinho: carrinho.map(p => ({ id: p.id, quantidade: Math.max(1, Number(p.quantidade) || 1) })),
      endereco: {
        cep: cepEl.value.trim(),
        rua: ruaEl.value.trim(),
        numero: numeroEl.value.trim(),
        complemento: document.getElementById('complemento').value.trim(),
        bairro: bairroEl.value.trim(),
        cidade: cidadeEl.value.trim(),
        estado: estadoEl.value.trim()
      },
      pagamento: inputPagamento.value,
      cupom: localStorage.getItem('cupom_seven_secrets') || ''
    };

    try {
      const resposta = await fetch('/api/pedidos/confirmacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido)
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível enviar o pedido.');

      localStorage.setItem('ultimo_pedido_seven_secrets', JSON.stringify(dados.pedido));
      localStorage.removeItem('carrinho');
      localStorage.removeItem('total_sacola');
      localStorage.removeItem('cupom_seven_secrets');
      localStorage.removeItem('endereco_transicao_sacola');
      localStorage.removeItem('cep_transicao_sacola');

      if (pedido.pagamento === 'pix') {
        window.location.href = `/pagamento-pix?pedido=${encodeURIComponent(dados.pedido.numero)}`;
        return;
      }

      exibirFeedback(`Pedido ${dados.pedido.numero} registrado com sucesso!`, 'sucesso');
      setTimeout(() => { window.location.href = '/'; }, 2000);
    } catch (erro) {
      exibirFeedback(erro.message || 'Erro ao enviar o pedido. Verifique se o servidor está ativo.', 'erro');
    } finally {
      if (btn) {
        btn.disabled = false;
        atualizarBotaoFinalizar();
      }
    }
  });
}
