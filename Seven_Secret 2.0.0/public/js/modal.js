/* Modal reutilizável: mostrarAviso(mensagem, titulo), confirmarAcao(mensagem, titulo). */
(function () {
  'use strict';
  const fila = [];
  let ativo = false;
  let focoAnterior = null;
  function elementos() {
    return { overlay:document.getElementById('ss-modal-overlay'), titulo:document.getElementById('ss-modal-title'), mensagem:document.getElementById('ss-modal-message'), confirmar:document.getElementById('ss-modal-confirmar'), cancelar:document.getElementById('ss-modal-cancelar'), icone:document.getElementById('ss-modal-icon') };
  }
  function proximo() {
    if (ativo || !fila.length) return;
    const e = elementos();
    if (!e.overlay) { const item=fila.shift(); window.setTimeout(()=>item.resolve(false),0); return; }
    ativo=true;
    const item=fila.shift();
    focoAnterior=document.activeElement;
    e.titulo.textContent=item.titulo || (item.tipo==='confirmacao'?'Confirmar ação':'Aviso');
    e.mensagem.textContent=String(item.mensagem ?? '');
  
    e.cancelar.hidden=item.tipo!=='confirmacao';
    e.confirmar.textContent='Confirmar';
    e.overlay.hidden=false;
    function fechar(valor) {
      e.overlay.hidden=true;
      e.confirmar.removeEventListener('click', ok);
      e.cancelar.removeEventListener('click', cancelar);
      e.overlay.removeEventListener('keydown', teclado);
      ativo=false;
      if(focoAnterior && typeof focoAnterior.focus==='function') focoAnterior.focus();
      item.resolve(valor);
      proximo();
    }
    function ok(){fechar(true);}
    function cancelar(){fechar(false);}
    function teclado(ev){if(ev.key==='Escape' && item.tipo==='confirmacao'){ev.preventDefault();cancelar();} if(ev.key==='Tab'){const b=e.cancelar.hidden?[e.confirmar]:[e.cancelar,e.confirmar];const idx=b.indexOf(document.activeElement);if(ev.shiftKey && idx===0){ev.preventDefault();b[b.length-1].focus();}else if(!ev.shiftKey && idx===b.length-1){ev.preventDefault();b[0].focus();}}}
    e.confirmar.addEventListener('click',ok);
    e.cancelar.addEventListener('click',cancelar);
    e.overlay.addEventListener('keydown',teclado);
    e.confirmar.focus();
  }
  function abrir(mensagem,titulo,tipo){return new Promise(resolve=>{fila.push({mensagem,titulo,tipo,resolve});proximo();});}
  window.mostrarAviso=(mensagem,titulo='Aviso')=>abrir(mensagem,titulo,'aviso');
  window.confirmarAcao=(mensagem,titulo='Confirmar ação')=>abrir(mensagem,titulo,'confirmacao');
  // Compatibilidade com avisos legados: alert deixa de abrir a caixa nativa.
  window.alert=(mensagem)=>window.mostrarAviso(mensagem);
})();
