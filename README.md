# API Estoque Flow

API REST para gerenciamento de estoque com suporte multi-tenant — cada conta cria sua própria empresa isolada, com usuários, produtos, movimentações e ordens de compra separados por `empresa_id`.

**Produção:** `https://api-estoque-flow-1.onrender.com`  
**Local:** `http://localhost:3001`

---

## Tecnologias

- Node.js + TypeScript
- Express 5
- PostgreSQL (Supabase)
- JWT para autenticação
- bcryptjs para hash de senhas
- Render para deploy

---

## Estrutura do projeto

```
api/
├── src/
│   ├── config/
│   │   └── database.ts        # Configuração do pool PostgreSQL
│   ├── controllers/
│   │   ├── authController.ts  # Registro, login, perfil, empresa
│   │   ├── mainController.ts  # Categorias, fornecedores, estoque, movimentações, ordens
│   │   └── produtosController.ts # CRUD de produtos
│   ├── middleware/
│   │   └── auth.ts            # Middleware JWT (autenticar + autorizar)
│   ├── routes/
│   │   └── index.ts           # Todas as rotas
│   ├── types/
│   │   └── index.ts           # Tipos globais (JwtPayload, Request)
│   └── server.ts              # Entry point do Express
├── database.sql               # Script de criação das tabelas
├── package.json
└── tsconfig.json
```

---

## Configuração local

### 1. Pré-requisitos

- Node.js 18+
- PostgreSQL ou conta no Supabase

### 2. Instalar dependências

```bash
cd api
npm install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env` na pasta `api/`:

```env
DATABASE_URL=postgresql://usuario:senha@host:5432/postgres
JWT_SECRET=sua-chave-secreta-aqui
NODE_ENV=development
PORT=3001
```

### 4. Criar as tabelas

Execute o arquivo `database.sql` no seu banco PostgreSQL:

```bash
psql $DATABASE_URL -f database.sql
```

Ou cole o conteúdo diretamente no **Supabase → SQL Editor**.

### 5. Rodar em desenvolvimento

```bash
npm run dev
```

### 6. Build e produção

```bash
npm run build
npm start
```

---

## Autenticação

Todas as rotas protegidas exigem o header:

```
Authorization: Bearer SEU_TOKEN_JWT
```

O token é retornado no login e no registro. Ele expira em **7 dias**.

### Perfis de acesso

| Perfil | Permissões |
|---|---|
| `admin` | Acesso total |
| `gerente` | Leitura + criação + edição (sem delete de recursos críticos) |
| `operador` | Somente leitura e movimentações |

---

## Rotas

> **Local:** `http://localhost:3001/api/v1`  
> **Produção:** `https://api-estoque-flow-1.onrender.com/api/v1`

---

### Health Check

| Método | Local | Produção |
|---|---|---|
| GET | `http://localhost:3001/health` | `https://api-estoque-flow-1.onrender.com/health` |

---

### Auth & Empresa

| Método | Local | Produção | Auth |
|---|---|---|---|
| POST | `http://localhost:3001/api/v1/auth/registrar` | `https://api-estoque-flow-1.onrender.com/api/v1/auth/registrar` | público |
| POST | `http://localhost:3001/api/v1/auth/login` | `https://api-estoque-flow-1.onrender.com/api/v1/auth/login` | público |
| GET | `http://localhost:3001/api/v1/auth/perfil` | `https://api-estoque-flow-1.onrender.com/api/v1/auth/perfil` | 🔒 |
| PUT | `http://localhost:3001/api/v1/auth/alterar-senha` | `https://api-estoque-flow-1.onrender.com/api/v1/auth/alterar-senha` | 🔒 |
| GET | `http://localhost:3001/api/v1/empresa` | `https://api-estoque-flow-1.onrender.com/api/v1/empresa` | 🔒 |
| PUT | `http://localhost:3001/api/v1/empresa` | `https://api-estoque-flow-1.onrender.com/api/v1/empresa` | 🔒 admin |
| GET | `http://localhost:3001/api/v1/empresa/usuarios` | `https://api-estoque-flow-1.onrender.com/api/v1/empresa/usuarios` | 🔒 admin/gerente |
| POST | `http://localhost:3001/api/v1/empresa/usuarios/convidar` | `https://api-estoque-flow-1.onrender.com/api/v1/empresa/usuarios/convidar` | 🔒 admin |

#### POST /auth/registrar
```json
{
  "nome": "João Silva",
  "email": "joao@empresa.com",
  "senha": "minhasenha123",
  "nome_empresa": "Minha Empresa"
}
```

#### POST /auth/login
```json
{
  "email": "joao@empresa.com",
  "senha": "minhasenha123"
}
```

---

### Categorias

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/categorias` | `https://api-estoque-flow-1.onrender.com/api/v1/categorias` | 🔒 |
| POST | `http://localhost:3001/api/v1/categorias` | `https://api-estoque-flow-1.onrender.com/api/v1/categorias` | 🔒 admin/gerente |
| PUT | `http://localhost:3001/api/v1/categorias/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/categorias/:id` | 🔒 admin/gerente |
| DELETE | `http://localhost:3001/api/v1/categorias/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/categorias/:id` | 🔒 admin |

#### POST /categorias
```json
{
  "nome": "Eletrônicos",
  "descricao": "Produtos eletrônicos em geral"
}
```

---

### Fornecedores

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/fornecedores` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores` | 🔒 |
| GET | `http://localhost:3001/api/v1/fornecedores/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores/:id` | 🔒 |
| GET | `http://localhost:3001/api/v1/fornecedores/:id/produtos` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores/:id/produtos` | 🔒 |
| POST | `http://localhost:3001/api/v1/fornecedores` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores` | 🔒 admin/gerente |
| PUT | `http://localhost:3001/api/v1/fornecedores/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores/:id` | 🔒 admin/gerente |
| DELETE | `http://localhost:3001/api/v1/fornecedores/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/fornecedores/:id` | 🔒 admin |

#### POST /fornecedores
```json
{
  "nome": "Fornecedor ABC",
  "cnpj": "12.345.678/0001-99",
  "email": "contato@fornecedor.com",
  "telefone": "(11) 99999-9999",
  "contato_nome": "Carlos"
}
```

---

### Produtos

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/produtos` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos` | 🔒 |
| GET | `http://localhost:3001/api/v1/produtos/alertas/abaixo-minimo` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos/alertas/abaixo-minimo` | 🔒 |
| GET | `http://localhost:3001/api/v1/produtos/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos/:id` | 🔒 |
| GET | `http://localhost:3001/api/v1/produtos/:id/historico` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos/:id/historico` | 🔒 |
| POST | `http://localhost:3001/api/v1/produtos` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos` | 🔒 admin/gerente |
| PUT | `http://localhost:3001/api/v1/produtos/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos/:id` | 🔒 admin/gerente |
| DELETE | `http://localhost:3001/api/v1/produtos/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/produtos/:id` | 🔒 admin |

#### POST /produtos
```json
{
  "codigo": "PROD-001",
  "nome": "Notebook Dell",
  "descricao": "Notebook 15 polegadas",
  "categoria_id": "uuid-da-categoria",
  "fornecedor_id": "uuid-do-fornecedor",
  "preco_custo": 2500.00,
  "preco_venda": 3200.00,
  "unidade_medida": "UN",
  "estoque_minimo": 5,
  "estoque_maximo": 50
}
```

---

### Estoque

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/estoque` | `https://api-estoque-flow-1.onrender.com/api/v1/estoque` | 🔒 |
| GET | `http://localhost:3001/api/v1/estoque/resumo` | `https://api-estoque-flow-1.onrender.com/api/v1/estoque/resumo` | 🔒 |
| POST | `http://localhost:3001/api/v1/estoque/ajuste` | `https://api-estoque-flow-1.onrender.com/api/v1/estoque/ajuste` | 🔒 admin/gerente |

#### POST /estoque/ajuste
```json
{
  "produto_id": "uuid-do-produto",
  "quantidade": 100,
  "motivo": "Inventário inicial"
}
```

---

### Movimentações

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/movimentacoes` | `https://api-estoque-flow-1.onrender.com/api/v1/movimentacoes` | 🔒 |
| GET | `http://localhost:3001/api/v1/movimentacoes/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/movimentacoes/:id` | 🔒 |
| POST | `http://localhost:3001/api/v1/movimentacoes/entrada` | `https://api-estoque-flow-1.onrender.com/api/v1/movimentacoes/entrada` | 🔒 |
| POST | `http://localhost:3001/api/v1/movimentacoes/saida` | `https://api-estoque-flow-1.onrender.com/api/v1/movimentacoes/saida` | 🔒 |

#### POST /movimentacoes/entrada
```json
{
  "produto_id": "uuid-do-produto",
  "quantidade": 20,
  "motivo": "Compra de reposição",
  "fornecedor_id": "uuid-do-fornecedor",
  "preco_unitario": 2500.00
}
```

#### POST /movimentacoes/saida
```json
{
  "produto_id": "uuid-do-produto",
  "quantidade": 5,
  "motivo": "Venda para cliente"
}
```

---

### Ordens de Compra

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/ordens-compra` | `https://api-estoque-flow-1.onrender.com/api/v1/ordens-compra` | 🔒 |
| GET | `http://localhost:3001/api/v1/ordens-compra/:id` | `https://api-estoque-flow-1.onrender.com/api/v1/ordens-compra/:id` | 🔒 |
| POST | `http://localhost:3001/api/v1/ordens-compra` | `https://api-estoque-flow-1.onrender.com/api/v1/ordens-compra` | 🔒 admin/gerente |
| PATCH | `http://localhost:3001/api/v1/ordens-compra/:id/status` | `https://api-estoque-flow-1.onrender.com/api/v1/ordens-compra/:id/status` | 🔒 admin/gerente |

#### POST /ordens-compra
```json
{
  "fornecedor_id": "uuid-do-fornecedor",
  "data_prevista": "2025-12-31",
  "observacoes": "Urgente",
  "itens": [
    {
      "produto_id": "uuid-do-produto",
      "quantidade": 10,
      "preco_unitario": 2500.00
    }
  ]
}
```

#### PATCH /ordens-compra/:id/status
```json
{
  "status": "aprovada"
}
```

> Status disponíveis: `rascunho` → `enviada` → `aprovada` → `recebida` / `cancelada`

---

### Relatórios

| Método | Local | Produção | Auth |
|---|---|---|---|
| GET | `http://localhost:3001/api/v1/relatorios/dashboard` | `https://api-estoque-flow-1.onrender.com/api/v1/relatorios/dashboard` | 🔒 |
| GET | `http://localhost:3001/api/v1/relatorios/valorizacao-estoque` | `https://api-estoque-flow-1.onrender.com/api/v1/relatorios/valorizacao-estoque` | 🔒 |
| GET | `http://localhost:3001/api/v1/relatorios/movimentacoes-periodo` | `https://api-estoque-flow-1.onrender.com/api/v1/relatorios/movimentacoes-periodo` | 🔒 |
| GET | `http://localhost:3001/api/v1/relatorios/produtos-mais-movimentados` | `https://api-estoque-flow-1.onrender.com/api/v1/relatorios/produtos-mais-movimentados` | 🔒 |

---

## Fluxo de uso recomendado

1. `POST /auth/registrar` — cria a conta e a empresa, guarda o `token`
2. `POST /categorias` — cria as categorias de produto
3. `POST /fornecedores` — cadastra os fornecedores
4. `POST /produtos` — cadastra os produtos com categoria e fornecedor
5. `POST /estoque/ajuste` — define o estoque inicial de cada produto
6. `POST /movimentacoes/entrada` ou `/saida` — registra as movimentações
7. `GET /relatorios/dashboard` — visualiza o resumo geral

---

## Deploy no Render

| Campo | Valor |
|---|---|
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Root Directory | `api` |

### Variáveis de ambiente no Render

| Chave | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Supabase (Session Pooler, porta 6543) |
| `JWT_SECRET` | String longa e aleatória |
| `NODE_ENV` | `production` |

> Use o **Session Pooler** do Supabase (porta 6543) — o Render no plano gratuito não suporta IPv6.

---

## Banco de dados

O script `database.sql` cria as seguintes tabelas:

- `empresas` — tenant raiz, isola todos os dados
- `usuarios` — pertence a uma empresa, com perfis admin/gerente/operador
- `categorias` — categorias de produto por empresa
- `fornecedores` — fornecedores por empresa
- `produtos` — cadastro de produtos com preço e limites de estoque
- `estoque` — posição atual de cada produto
- `movimentacoes` — histórico completo de entradas, saídas e ajustes
- `ordens_compra` — ordens de compra com itens
- `itens_ordem_compra` — itens de cada ordem

E as views:

- `vw_posicao_estoque` — visão consolidada do estoque com situação (normal/crítico/zerado/excesso)
- `vw_movimentacoes_mes` — movimentações agrupadas por mês
