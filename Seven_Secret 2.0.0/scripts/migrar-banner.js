// Migração idempotente: cria apenas a configuração do banner principal.
require('dotenv').config();
const { pool } = require('../db/pool');
const { CREATE_BANNER_TABLE_SQL } = require('../db/banner');

(async () => {
  try {
    await pool.execute(CREATE_BANNER_TABLE_SQL);
    console.log('Configuração do banner disponível. Produtos e pedidos foram preservados.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
