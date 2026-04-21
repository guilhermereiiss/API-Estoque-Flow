-- ============================================================
--  SISTEMA MULTI-TENANT DE ESTOQUE
--  Cada usuário que se registra cria sua própria empresa.
--  Todos os dados são isolados por empresa_id.
--  Execute no Supabase SQL Editor (DROP + recria tudo limpo)
-- ============================================================

-- Limpa tudo (ordem correta por dependências)
DROP TABLE IF EXISTS itens_ordem_compra CASCADE;
DROP TABLE IF EXISTS ordens_compra CASCADE;
DROP TABLE IF EXISTS movimentacoes CASCADE;
DROP TABLE IF EXISTS estoque CASCADE;
DROP TABLE IF EXISTS produtos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS fornecedores CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;
DROP VIEW IF EXISTS vw_posicao_estoque CASCADE;
DROP VIEW IF EXISTS vw_movimentacoes_mes CASCADE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── EMPRESAS (cada conta é uma empresa isolada) ─────────────
CREATE TABLE empresas (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome           VARCHAR(200) NOT NULL,
  cnpj           VARCHAR(18),
  telefone       VARCHAR(20),
  email_contato  VARCHAR(150),
  endereco       VARCHAR(255),
  cidade         VARCHAR(100),
  estado         VARCHAR(2),
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USUÁRIOS (pertencem a uma empresa) ──────────────────────
CREATE TABLE usuarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          VARCHAR(150) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  perfil        VARCHAR(20) NOT NULL DEFAULT 'operador'
                  CHECK (perfil IN ('admin', 'gerente', 'operador')),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── CATEGORIAS (por empresa) ─────────────────────────────────
CREATE TABLE categorias (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       VARCHAR(100) NOT NULL,
  descricao  TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, nome)   -- mesmo nome pode existir em empresas diferentes
);

-- ─── FORNECEDORES (por empresa) ───────────────────────────────
CREATE TABLE fornecedores (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          VARCHAR(150) NOT NULL,
  cnpj          VARCHAR(18),
  email         VARCHAR(150),
  telefone      VARCHAR(20),
  endereco      VARCHAR(255),
  cidade        VARCHAR(100),
  estado        VARCHAR(2),
  cep           VARCHAR(10),
  contato_nome  VARCHAR(150),
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, cnpj)
);

-- ─── PRODUTOS (por empresa) ───────────────────────────────────
CREATE TABLE produtos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id     UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo         VARCHAR(50) NOT NULL,
  nome           VARCHAR(200) NOT NULL,
  descricao      TEXT,
  categoria_id   UUID REFERENCES categorias(id) ON DELETE SET NULL,
  fornecedor_id  UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  preco_custo    NUMERIC(12,2) NOT NULL DEFAULT 0,
  preco_venda    NUMERIC(12,2) NOT NULL DEFAULT 0,
  unidade_medida VARCHAR(10) NOT NULL DEFAULT 'UN',
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  estoque_maximo NUMERIC(12,3) NOT NULL DEFAULT 9999,
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, codigo)  -- mesmo código pode existir em empresas diferentes
);

-- ─── ESTOQUE (por produto) ────────────────────────────────────
CREATE TABLE estoque (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produto_id    UUID NOT NULL UNIQUE REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade    NUMERIC(12,3) NOT NULL DEFAULT 0,
  localizacao   VARCHAR(100),
  lote          VARCHAR(100),
  data_validade DATE,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── MOVIMENTAÇÕES (por empresa) ─────────────────────────────
CREATE TABLE movimentacoes (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id           UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  produto_id           UUID NOT NULL REFERENCES produtos(id),
  tipo                 VARCHAR(20) NOT NULL
                         CHECK (tipo IN ('entrada','saida','ajuste','transferencia')),
  quantidade           NUMERIC(12,3) NOT NULL,
  quantidade_anterior  NUMERIC(12,3) NOT NULL,
  quantidade_posterior NUMERIC(12,3) NOT NULL,
  motivo               TEXT,
  referencia           VARCHAR(100),
  usuario_id           UUID NOT NULL REFERENCES usuarios(id),
  fornecedor_id        UUID REFERENCES fornecedores(id),
  preco_unitario       NUMERIC(12,2),
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ORDENS DE COMPRA (por empresa) ──────────────────────────
CREATE TABLE ordens_compra (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id),
  usuario_id    UUID NOT NULL REFERENCES usuarios(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviada','aprovada','recebida','cancelada')),
  valor_total   NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes   TEXT,
  data_prevista DATE,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ITENS DA ORDEM DE COMPRA ─────────────────────────────────
CREATE TABLE itens_ordem_compra (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ordem_compra_id UUID NOT NULL REFERENCES ordens_compra(id) ON DELETE CASCADE,
  produto_id      UUID NOT NULL REFERENCES produtos(id),
  quantidade      NUMERIC(12,3) NOT NULL,
  preco_unitario  NUMERIC(12,2) NOT NULL,
  subtotal        NUMERIC(14,2) NOT NULL
);

-- ─── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX idx_usuarios_empresa       ON usuarios(empresa_id);
CREATE INDEX idx_categorias_empresa     ON categorias(empresa_id);
CREATE INDEX idx_fornecedores_empresa   ON fornecedores(empresa_id);
CREATE INDEX idx_produtos_empresa       ON produtos(empresa_id);
CREATE INDEX idx_produtos_codigo        ON produtos(empresa_id, codigo);
CREATE INDEX idx_estoque_produto        ON estoque(produto_id);
CREATE INDEX idx_movimentacoes_empresa  ON movimentacoes(empresa_id);
CREATE INDEX idx_movimentacoes_produto  ON movimentacoes(produto_id);
CREATE INDEX idx_movimentacoes_tipo     ON movimentacoes(tipo);
CREATE INDEX idx_movimentacoes_data     ON movimentacoes(criado_em DESC);
CREATE INDEX idx_ordens_empresa         ON ordens_compra(empresa_id);
CREATE INDEX idx_ordens_status          ON ordens_compra(status);
CREATE INDEX idx_itens_ordem            ON itens_ordem_compra(ordem_compra_id);

-- ─── VIEW: POSIÇÃO DE ESTOQUE ─────────────────────────────────
CREATE OR REPLACE VIEW vw_posicao_estoque AS
SELECT
  p.empresa_id,
  p.id, p.codigo, p.nome, p.unidade_medida,
  c.nome                            AS categoria,
  f.nome                            AS fornecedor,
  COALESCE(e.quantidade, 0)         AS estoque_atual,
  p.estoque_minimo, p.estoque_maximo,
  p.preco_custo, p.preco_venda,
  COALESCE(e.quantidade,0) * p.preco_custo  AS valor_custo_total,
  COALESCE(e.quantidade,0) * p.preco_venda  AS valor_venda_total,
  CASE
    WHEN COALESCE(e.quantidade,0) = 0                THEN 'zerado'
    WHEN COALESCE(e.quantidade,0) <= p.estoque_minimo THEN 'critico'
    WHEN COALESCE(e.quantidade,0) >= p.estoque_maximo THEN 'excesso'
    ELSE 'normal'
  END AS situacao,
  p.ativo
FROM produtos p
LEFT JOIN estoque     e ON e.produto_id  = p.id
LEFT JOIN categorias  c ON c.id          = p.categoria_id
LEFT JOIN fornecedores f ON f.id         = p.fornecedor_id;
