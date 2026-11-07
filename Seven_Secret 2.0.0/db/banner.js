const { pool } = require('./pool');

// Conteúdo usado antes da primeira edição, igual ao banner original da loja.
const defaultBanner = Object.freeze({
  eyebrow: 'Seven Secrets · Alta perfumaria',
  title: 'O seu segredo.\nA sua essência.',
  subtitle: 'Fragrâncias que revelam sua personalidade e tornam cada presença inesquecível.',
  buttonText: 'Explore a coleção',
  buttonUrl: '#produtos',
  image: '/img/Extase.png',
  imageAlt: '',
  caption: 'Uma assinatura que permanece.'
});

const CREATE_BANNER_TABLE_SQL = `CREATE TABLE IF NOT EXISTS loja_banner (
  id          TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  eyebrow     VARCHAR(120) NOT NULL,
  title       VARCHAR(180) NOT NULL,
  subtitle    VARCHAR(500) NOT NULL,
  button_text VARCHAR(80)  NOT NULL,
  button_url  VARCHAR(500) NOT NULL,
  image       VARCHAR(500) NOT NULL,
  image_alt   VARCHAR(180) NOT NULL DEFAULT '',
  caption     VARCHAR(180) NOT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

// A aplicação só lê/grava id=1: o banner não compartilha registros com produtos.
const fields = [
  ['eyebrow', 'eyebrow'], ['title', 'title'], ['subtitle', 'subtitle'],
  ['button_text', 'buttonText'], ['button_url', 'buttonUrl'],
  ['image', 'image'], ['image_alt', 'imageAlt'], ['caption', 'caption']
];

async function getBanner() {
  try {
    const [rows] = await pool.execute(
      `SELECT ${fields.map(([column, key]) => `${column} AS ${key}`).join(',')} FROM loja_banner WHERE id=1 LIMIT 1`
    );
    return rows[0] || { ...defaultBanner };
  } catch (err) {
    // Permite servir a home anterior até a migração; falhas de conexão não são ocultadas.
    if (err.code === 'ER_NO_SUCH_TABLE') return { ...defaultBanner };
    throw err;
  }
}

async function saveBanner(data) {
  const values = fields.map(([, key]) => data[key]);
  await pool.execute(
    `INSERT INTO loja_banner (id,${fields.map(([column]) => column).join(',')}) VALUES (1,${fields.map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${fields.map(([column]) => `${column}=?`).join(',')}`,
    [...values, ...values]
  );
  // A gravação já terminou; uma releitura poderia falhar após o commit e fazer
  // o chamador tratar como falha um banner que já referencia a imagem salva.
  return Object.fromEntries(fields.map(([, key]) => [key, data[key]]));
}

module.exports = { defaultBanner, getBanner, saveBanner, CREATE_BANNER_TABLE_SQL };
