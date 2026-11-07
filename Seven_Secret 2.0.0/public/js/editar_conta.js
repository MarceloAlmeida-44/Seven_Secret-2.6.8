document.addEventListener('DOMContentLoaded',async()=>{
  // Sair da conta: encerra a sessão no servidor e volta para a tela de login.
  document.getElementById('btnSair')?.addEventListener('click',async()=>{
    const confirmou=typeof confirmarAcao==='function'?await confirmarAcao('Deseja sair da sua conta?','Sair da conta'):confirm('Deseja sair da sua conta?');
    if(!confirmou)return;
    try{await fetch('/api/logout',{method:'POST'});}catch(e){console.error('Erro ao sair:',e);}
    // Dados de entrega ficam salvos só para quem estava logado.
    ['endereco_transicao_sacola','cep_transicao_sacola'].forEach(k=>localStorage.removeItem(k));
    location.href='/conta';
  });
  const r=await fetch('/api/conta');const j=await r.json();if(!j.usuario){location.href='/conta';return;}
  for(const campo of ['nome','email','cpf','nascimento']){const el=document.getElementById(campo);if(el)el.value=j.usuario[campo]||'';}
  document.getElementById('profileForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const dados={nome:document.getElementById('nome').value,email:document.getElementById('email').value,senha:document.getElementById('senha').value};
    const r=await fetch('/api/conta',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(dados)});const j=await r.json();alert(r.ok?'Dados atualizados!':j.erro);
  });
  const r2=await fetch('/api/pedidos');const j2=await r2.json();const el=document.getElementById('productsContainer');
  if(el)el.innerHTML=(j2.pedidos||[]).map(p=>`<div class="produto-item"><div class="produto-info"><h3>Pedido ${p.numero}</h3><p>${p.itens.map(i=>`${i.nome} (${i.quantidade}x)`).join(', ')}</p><p>Total: R$ ${p.total.toFixed(2).replace('.',',')} — ${p.status}</p></div></div>`).join('')||'<p>Nenhum pedido realizado ainda.</p>';
});
