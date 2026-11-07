// Migração idempotente: preserva os produtos existentes.
require('dotenv').config();
const { pool } = require('../db/pool');
(async () => {
  try {
    const [columns] = await pool.execute("SHOW COLUMNS FROM produtos LIKE 'destaque'");
    if (!columns.length) await pool.execute('ALTER TABLE produtos ADD COLUMN destaque BOOLEAN NOT NULL DEFAULT FALSE');
    // Compatibilidade com bancos antigos que ainda não têm o estoque usado pela loja.
    // Inicia em zero para que a quantidade real seja informada pela administração.
    const [stockColumns] = await pool.execute("SHOW COLUMNS FROM produtos LIKE 'estoque'");
    if (!stockColumns.length) {
      await pool.execute('ALTER TABLE produtos ADD COLUMN estoque INT UNSIGNED NOT NULL DEFAULT 0');
      console.log('Estoque adicionado: informe as quantidades reais na administração.');
    }
    console.log('Campo destaque disponível.');
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
