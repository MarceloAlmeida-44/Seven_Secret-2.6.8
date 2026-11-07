
const boxPix = document.getElementById('pix-pagamento');
const numeroPedido = boxPix.dataset.pedido;
const emailPedido = boxPix.dataset.email;
const elAguardando = document.getElementById('pix-aguardando');
const elPago = document.getElementById('pix-pago');
const elEmail = document.getElementById('pix-email');

const btnCopiar = document.getElementById('btn-copiar');
if (btnCopiar) {
  btnCopiar.addEventListener('click', async () => {
    const campo = document.getElementById('pix-link');
    try { await navigator.clipboard.writeText(campo.value); }
    catch { campo.select(); document.execCommand('copy'); }
    btnCopiar.lastChild.textContent = ' Copiado!';
    setTimeout(() => { btnCopiar.lastChild.textContent = ' Copiar'; }, 2000);
  });
}

function mostrarPagamentoConfirmado(emailEnviado) {
  elAguardando.hidden = true;
  elPago.hidden = false;
  if (emailEnviado === true) elEmail.textContent = `Enviamos os dados do pedido para ${emailPedido}.`;
  else if (emailEnviado === false) elEmail.textContent = 'Pagamento confirmado, mas o e-mail não pôde ser enviado. Confira a configuração SMTP.';
  else elEmail.textContent = 'Enviando os dados do pedido por e-mail...';
}

// Consulta o servidor até o QR Code ser lido (pedido pago) e o e-mail ser processado.
async function verificarPagamento() {
  try {
    const resposta = await fetch(`/api/pedidos/${encodeURIComponent(numeroPedido)}/status`);
    if (resposta.status === 401) { window.location.href = '/conta'; return; }
    if (resposta.status === 404) return;
    const dados = await resposta.json();
    if (dados.status === 'Pago') {
      mostrarPagamentoConfirmado(dados.emailEnviado);
      if (dados.emailEnviado !== null) return;
    }
  } catch { /* servidor indisponível: tenta de novo */ }
  setTimeout(verificarPagamento, 3000);
}

verificarPagamento();
