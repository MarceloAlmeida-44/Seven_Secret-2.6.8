const mysql = require('mysql2/promise');
const pool = mysql.createPool({
    
    host:process.env.DB_HOST || 'localhost',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USER || 'root',password:process.env.DB_PASS || process.env.DB_PASSWORD || '1234',database:process.env.DB_NAME || 'seven_secrets',waitForConnections:true,connectionLimit:10,decimalNumbers:true,charset:'utf8mb4'

});


async function products(q='') {
 const termo=String(q || '').trim().slice(0,100);
 const params=[];
 let sql='SELECT id,tipo,nome,preco,desconto,capacidade,descricao,imagem,estoque,destaque,criado_em FROM produtos WHERE ativo=1';
 if(termo){sql+=' AND (nome LIKE ? OR tipo LIKE ? OR descricao LIKE ? OR capacidade LIKE ?)';const like='%'+termo.replace(/[\%_]/g, '\\$&')+'%'; params.push(...Array(4).fill(like));}
 sql+=' ORDER BY id ASC';
 const [rows]=await pool.execute(sql,params);
 return rows;
}

async function allProducts() {
 const [rows]=await pool.execute('SELECT id,tipo,nome,preco,desconto,capacidade,descricao,imagem,estoque,ativo,destaque,criado_em FROM produtos ORDER BY id DESC');
 return rows;
}

async function createProduct(p) {
 const [r]=await pool.execute('INSERT INTO produtos (tipo,nome,preco,desconto,capacidade,descricao,imagem,estoque,destaque) VALUES (?,?,?,?,?,?,?,?,?)',[p.tipo,p.nome,p.preco,p.desconto,p.capacidade,p.descricao,p.imagem,p.estoque,p.destaque?1:0]);
 return r.insertId;
}

async function setProductActive(id,ativo) {
 const [r]=await pool.execute('UPDATE produtos SET ativo=? WHERE id=?',[ativo?1:0,id]);
 return r.affectedRows;
}

async function setProductStock(id,estoque) {
 const [r]=await pool.execute('UPDATE produtos SET estoque=? WHERE id=?',[estoque,id]);
 return r.affectedRows;
}
async function getProduct(id) {
 const [rows]=await pool.execute('SELECT id,tipo,nome,preco,desconto,capacidade,descricao,imagem,estoque,destaque FROM produtos WHERE id=? AND ativo=1',[id]);
 return rows[0] || null;
}
async function setProductFeatured(id,destaque) {
 const [r]=await pool.execute('UPDATE produtos SET destaque=? WHERE id=?',[destaque?1:0,id]);
 return r.affectedRows;
}
module.exports={pool,products,allProducts,createProduct,setProductActive,setProductStock,getProduct,setProductFeatured};
