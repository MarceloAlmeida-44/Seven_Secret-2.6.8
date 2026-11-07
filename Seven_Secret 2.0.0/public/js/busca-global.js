(() => {
  'use strict';
  const markup = `<div id="search-overlay" class="search-overlay" role="dialog" aria-modal="true" aria-label="Pesquisar perfumes" aria-hidden="true">
    <button type="button" class="close-search" id="close-search" aria-label="Fechar pesquisa"><i data-lucide="x"></i></button>
    <div class="search-content"><p class="search-label">O que você procura hoje?</p>
      <form class="search-input-wrapper" action="/" method="GET">
        <input type="search" id="search-input" name="q" placeholder="Buscar fragrâncias, notas ou coleções..." autocomplete="off" aria-label="Pesquisar perfumes">
        <button type="submit" aria-label="Pesquisar"><i data-lucide="search" class="search-icon-bg"></i></button>
      </form>
      <div class="search-suggestions" id="search-suggestions" aria-live="polite"><span>Digite para pesquisar os perfumes disponíveis.</span></div>
    </div>
  </div>`;
  function init() {
    const trigger = document.querySelector('.ss-header__link[title="Buscar"]');
    if (!trigger)
       return;
    if (!document.getElementById('search-overlay')) document.body.insertAdjacentHTML('beforeend', markup);
    const overlay = document.getElementById('search-overlay');
    const input = document.getElementById('search-input');
    const suggestions = document.getElementById('search-suggestions');
    let timer, controller, previousFocus;
    const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function close() {
      overlay.classList.remove('active'); overlay.setAttribute('aria-hidden','true');
      clearTimeout(timer); controller?.abort(); previousFocus?.focus();
    }
    trigger.addEventListener('click', event => {
      event.preventDefault(); previousFocus = document.activeElement;
      overlay.classList.add('active'); overlay.setAttribute('aria-hidden','false');
      input.focus(); if(input.value.trim()) search();
    });
    document.getElementById('close-search').addEventListener('click',close);
    overlay.addEventListener('click', event => {if(event.target===overlay)close();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('active'))close();});
    async function search() {
      const term=input.value.trim(); controller?.abort();
      if(!term){suggestions.textContent='Digite para pesquisar os perfumes disponíveis.';return;}
      const current=new AbortController();controller=current;
      suggestions.textContent='Pesquisando...';
      try {
        const response=await fetch('/api/produtos/busca?q='+encodeURIComponent(term),{signal:current.signal});
        if(!response.ok)throw new Error('Falha na busca');
        const products=await response.json();
        if(controller!==current||input.value.trim()!==term)return;
        if(!products.length){suggestions.textContent='Nenhum perfume encontrado. Tente outro termo.';return;}
        suggestions.innerHTML='<span>'+products.length+' resultado(s):</span>'+products.slice(0,8).map(product =>
          '<a class="search-result" href="/?q='+encodeURIComponent(product.nome)+'#produtos">'+escapeHTML(product.nome)+' <small>— '+escapeHTML(product.tipo)+'</small></a>'
        ).join('')+'<a class="search-see-all" href="/?q='+encodeURIComponent(term)+'#produtos">Ver todos os resultados</a>';
      } catch(error) {if(error.name!=='AbortError')suggestions.textContent='Não foi possível pesquisar agora. Tente novamente.';}
    }
    input.addEventListener('input',()=>{
      clearTimeout(timer);controller?.abort();
      if(!input.value.trim())suggestions.textContent='Digite para pesquisar os perfumes disponíveis.';
      else timer=setTimeout(search,250);
    });
    if(window.lucide?.createIcons)window.lucide.createIcons();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
