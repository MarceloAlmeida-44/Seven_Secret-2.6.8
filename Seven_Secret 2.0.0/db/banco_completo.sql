

CREATE DATABASE IF NOT EXISTS seven_secrets
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;


USE seven_secrets;


CREATE TABLE IF NOT EXISTS usuarios (
  id            VARCHAR(36)  NOT NULL PRIMARY KEY,
  nome          VARCHAR(160) NOT NULL,
  cpf           VARCHAR(20)  NOT NULL DEFAULT '',
  nascimento    VARCHAR(30)  NOT NULL DEFAULT '',
  email         VARCHAR(254) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  criado_em     TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS produtos (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo       VARCHAR(120)  NOT NULL,
  nome       VARCHAR(160)  NOT NULL,
  preco      DECIMAL(10,2) NOT NULL,
  desconto   DECIMAL(10,2) NULL,
  capacidade VARCHAR(120)  NOT NULL,
  descricao  TEXT          NOT NULL,
  imagem     VARCHAR(500)  NOT NULL,
  estoque    INT UNSIGNED  NOT NULL DEFAULT 0,
  ativo      BOOLEAN       NOT NULL DEFAULT TRUE,
  destaque BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS pedidos (
  numero        VARCHAR(80)   NOT NULL PRIMARY KEY,
  usuario_id    VARCHAR(36)   NOT NULL,
  email         VARCHAR(254)  NOT NULL,
  nome          VARCHAR(160)  NOT NULL,
  subtotal      DECIMAL(12,2) NOT NULL,
  frete         DECIMAL(12,2) NOT NULL,
  desconto      DECIMAL(12,2) NOT NULL,
  total         DECIMAL(12,2) NOT NULL,
  pagamento     ENUM('pix','cartao') NOT NULL,
  endereco      JSON          NOT NULL,
  status        VARCHAR(60)   NOT NULL,
  criado_em     DATETIME      NOT NULL,
  pago_em       DATETIME      NULL,
  email_enviado BOOLEAN       NULL,
  pix_token     VARCHAR(100)  NULL UNIQUE,
  CONSTRAINT fk_pedidos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS itens_pedido (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_numero  VARCHAR(80)     NOT NULL,
  produto_id     INT UNSIGNED    NULL,
  nome           VARCHAR(160)    NOT NULL,
  capacidade     VARCHAR(120)    NOT NULL,
  quantidade     INT             NOT NULL,
  preco_unitario DECIMAL(12,2)   NOT NULL,
  total          DECIMAL(12,2)   NOT NULL,
  CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_numero) REFERENCES pedidos(numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


INSERT IGNORE INTO produtos (id, tipo, nome, preco, desconto, capacidade, descricao, imagem, estoque) VALUES
(1, 'Floral Frutado', 'Extâse', 699.99, 499.99, 'Extâse - 100ml',
 'Uma fusão envolvente de rosas e framboesas maduras. Esta fragrância é uma celebração da paixão e da alegria, ideal para quem busca uma presença radiante e inesquecível.',
 '/img/Extase.png', 10),
(2, 'Fresco Vibrante', 'Trend', 659.99, 499.99, 'Trend - 100ml',
 'A frescura das flores brancas em harmonia com notas amadeiradas secas, flutuando sobre uma base líquida azul vibrante. Um perfume moderno e dinâmico, perfeito para quem dita tendências.',
 '/img/Trend.png', 10),
(3, 'Floral Refinado', 'Lavin', 599.99, 399.99, 'Lavin - 100ml',
 'Um bouquet sofisticado que une a suavidade da lavanda à elegância do jasmim. Esta fragrância oferece um rastro atemporal e refinado, para quem aprecia o luxo discreto.',
 '/img/Lavin.png', 10),
(4, 'Herbáceo Marcante', 'Adamantium', 699.99, 499.99, 'Adamantium - 100ml',
 'Uma essência verde e musgosa, com a presença marcante de ramos de lavanda sobre uma base de carvalho rústico. Um perfume que evoca a força da natureza e uma masculinidade autêntica.',
 '/img/Adamantium.png', 10);


SELECT id, nome, tipo, preco, desconto, capacidade, estoque, ativo
FROM produtos
ORDER BY id;
-- Verificar estrutura da tabela
DESCRIBE produtos;


-- Verificar produtos cadastrados
SELECT
    id,
    nome,
    estoque,
    ativo,
    destaque
FROM produtos
ORDER BY id;
