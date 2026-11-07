// Importação opcional e idempotente dos dados antigos (execute uma vez).
require('dotenv').config();
const fs=require('fs'),path=require('path');
const {pool}=require('../db/pool');
const {savePedido}=require('../db/orders');
const data=nome=>{const file=path.join(__dirname,'..','data',nome);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];};
(async()=>{
 try {
  for(const u of data('usuarios.json')) await pool.execute(
   'INSERT INTO usuarios (id,nome,cpf,nascimento,email,password_hash) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id',
   [u.id,u.nome,u.cpf||'',u.nascimento||'',u.email,u.passwordHash]);
  for(const p of data('pedidos.json')) {
   const [found]=await pool.execute('SELECT numero FROM pedidos WHERE numero=?',[p.numero]);
   if(found.length)continue;
   await savePedido(p);
   if(p.pagoEm) await pool.execute('UPDATE pedidos SET pago_em=? WHERE numero=?',[new Date(p.pagoEm),p.numero]);
  }
  console.log('Importação concluída. Guarde backup dos JSON antigos.');
 }catch(err){console.error(err);process.exitCode=1;}finally{await pool.end();}
})();
