const { pool } = require('./pool');
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
function map(row, items=[]) {
  if (!row) return null;
  return { numero:row.numero,usuarioId:row.usuario_id,email:row.email,nome:row.nome,
    itens: items,subtotal:Number(row.subtotal),frete:Number(row.frete),desconto:Number(row.desconto),total:Number(row.total),
    pagamento:row.pagamento,endereco:parse(row.endereco),status:row.status,
    criadoEm:new Date(row.criado_em).toISOString(),pagoEm:row.pago_em ? new Date(row.pago_em).toISOString() : null,
    emailEnviado:row.email_enviado === null ? null : Boolean(row.email_enviado),pixToken:row.pix_token };
}
async function getPedido(numero, usuarioId=null, pagamento=null, token=null) {
  const conditions=[], params=[];
  if(token) {conditions.push('pix_token=?');params.push(token);}
  else {conditions.push('numero=?');params.push(numero);}
  if(usuarioId){conditions.push('usuario_id=?');params.push(usuarioId);}
  if(pagamento){conditions.push('pagamento=?');params.push(pagamento);}
  const [rows]=await pool.execute(`SELECT * FROM pedidos WHERE ${conditions.join(' AND ')} LIMIT 1`,params);
  if(!rows.length)return null;
  const [items]=await pool.execute('SELECT produto_id AS id,nome,capacidade,quantidade,preco_unitario AS precoUnitario,total FROM itens_pedido WHERE pedido_numero=? ORDER BY id',[rows[0].numero]);
  return map(rows[0],items.map(i=>({...i,precoUnitario:Number(i.precoUnitario),total:Number(i.total)})));
}
async function listPedidos(usuarioId) {
  const [rows]=await pool.execute('SELECT numero FROM pedidos WHERE usuario_id=? ORDER BY criado_em DESC,numero DESC',[usuarioId]);
  return Promise.all(rows.map(async r=>{const p=await getPedido(r.numero,usuarioId);delete p.pixToken;return p;}));
}
async function savePedido(p) {
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('INSERT INTO pedidos (numero,usuario_id,email,nome,subtotal,frete,desconto,total,pagamento,endereco,status,criado_em,email_enviado,pix_token) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [p.numero,p.usuarioId,p.email,p.nome,p.subtotal,p.frete,p.desconto,p.total,p.pagamento,JSON.stringify(p.endereco),p.status,new Date(p.criadoEm),p.emailEnviado,p.pixToken||null]);
    // Baixa o estoque na mesma transação; se faltar unidade, o pedido inteiro é desfeito.
    for(const i of p.itens) {
      const [r]=await conn.execute('UPDATE produtos SET estoque=estoque-? WHERE id=? AND estoque>=?',[i.quantidade,i.id,i.quantidade]);
      if(!r.affectedRows) throw new Error(`Estoque insuficiente para ${i.nome}. Atualize a sacola e tente novamente.`);
    }
    for(const i of p.itens) await conn.execute('INSERT INTO itens_pedido (pedido_numero,produto_id,nome,capacidade,quantidade,preco_unitario,total) VALUES (?,?,?,?,?,?,?)',
      [p.numero,i.id,i.nome,i.capacidade,i.quantidade,i.precoUnitario,i.total]);
    await conn.commit();
  } catch(err) {await conn.rollback();throw err;} finally {conn.release();}
}
async function atualizarPedido(numero,campos) {
  const allowed={status:'status',pagoEm:'pago_em',emailEnviado:'email_enviado'};
  const entries=Object.entries(campos).filter(([k])=>allowed[k]);
  if(entries.length) await pool.execute(`UPDATE pedidos SET ${entries.map(([k])=>allowed[k]+'=?').join(',')} WHERE numero=?`,[...entries.map(([k,v])=>k==='pagoEm'&&v?new Date(v):v),numero]);
  return getPedido(numero);
}
module.exports={getPedido,listPedidos,savePedido,atualizarPedido};
