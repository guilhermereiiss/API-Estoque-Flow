import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

export const listar = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20, busca, categoria_id, fornecedor_id, ativo } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  const params: unknown[] = [empresa_id];
  const where: string[] = ['p.empresa_id = $1'];

  if (busca) { params.push(`%${busca}%`); where.push(`(p.nome ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`); }
  if (categoria_id) { params.push(categoria_id); where.push(`p.categoria_id = $${params.length}`); }
  if (fornecedor_id) { params.push(fornecedor_id); where.push(`p.fornecedor_id = $${params.length}`); }
  if (ativo !== undefined) { params.push(ativo === 'true'); where.push(`p.ativo = $${params.length}`); }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  try {
    const total = await pool.query(`SELECT COUNT(*) FROM produtos p ${whereClause}`, params);
    params.push(Number(limite), offset);

    const result = await pool.query(
      `SELECT p.*, c.nome as categoria_nome, f.nome as fornecedor_nome,
              COALESCE(e.quantidade, 0) as estoque_atual,
              CASE WHEN COALESCE(e.quantidade,0) <= p.estoque_minimo THEN true ELSE false END as alerta_minimo
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id AND c.empresa_id = $1
       LEFT JOIN fornecedores f ON f.id = p.fornecedor_id AND f.empresa_id = $1
       LEFT JOIN estoque e ON e.produto_id = p.id
       ${whereClause}
       ORDER BY p.nome
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      dados: result.rows,
      paginacao: { total: Number(total.rows[0].count), pagina: Number(pagina), limite: Number(limite), paginas: Math.ceil(Number(total.rows[0].count) / Number(limite)) }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar produtos', detalhe: String(err) });
  }
};

export const buscarPorId = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT p.*, c.nome as categoria_nome, f.nome as fornecedor_nome,
              COALESCE(e.quantidade, 0) as estoque_atual
       FROM produtos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       LEFT JOIN fornecedores f ON f.id = p.fornecedor_id
       LEFT JOIN estoque e ON e.produto_id = p.id
       WHERE p.id = $1 AND p.empresa_id = $2`,
      [req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar produto', detalhe: String(err) });
  }
};

export const criar = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { codigo, nome, descricao, categoria_id, fornecedor_id, preco_custo, preco_venda,
          unidade_medida = 'UN', estoque_minimo = 0, estoque_maximo = 9999,
          estoque_atual = 0 } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existe = await client.query('SELECT id FROM produtos WHERE codigo = $1 AND empresa_id = $2', [codigo, empresa_id]);
    if (existe.rows.length > 0) { res.status(409).json({ erro: 'Código já existe nesta empresa' }); return; }

    const id = uuidv4();
    const result = await client.query(
      `INSERT INTO produtos (id, empresa_id, codigo, nome, descricao, categoria_id, fornecedor_id,
        preco_custo, preco_venda, unidade_medida, estoque_minimo, estoque_maximo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [id, empresa_id, codigo, nome, descricao, categoria_id, fornecedor_id,
       preco_custo, preco_venda, unidade_medida, estoque_minimo, estoque_maximo]
    );

    // Cria estoque com quantidade inicial informada (default 0)
    await client.query(
      'INSERT INTO estoque (id, produto_id, quantidade) VALUES ($1,$2,$3)',
      [uuidv4(), id, Number(estoque_atual)]
    );

    // Se veio com estoque > 0, registra movimentação de entrada inicial
    if (Number(estoque_atual) > 0) {
      await client.query(
        `INSERT INTO movimentacoes
           (id, empresa_id, produto_id, tipo, quantidade, quantidade_anterior,
            quantidade_posterior, motivo, usuario_id)
         VALUES ($1,$2,$3,'entrada',$4,0,$5,'Estoque inicial no cadastro do produto',$6)`,
        [uuidv4(), empresa_id, id, Number(estoque_atual), Number(estoque_atual), req.usuario!.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...result.rows[0], estoque_atual: Number(estoque_atual) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao criar produto', detalhe: String(err) });
  } finally {
    client.release();
  }
};

export const atualizar = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { nome, descricao, categoria_id, fornecedor_id, preco_custo, preco_venda,
          unidade_medida, estoque_minimo, estoque_maximo, ativo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE produtos SET nome=$1, descricao=$2, categoria_id=$3, fornecedor_id=$4,
        preco_custo=$5, preco_venda=$6, unidade_medida=$7, estoque_minimo=$8,
        estoque_maximo=$9, ativo=$10, atualizado_em=NOW()
       WHERE id=$11 AND empresa_id=$12 RETURNING *`,
      [nome, descricao, categoria_id, fornecedor_id, preco_custo, preco_venda,
       unidade_medida, estoque_minimo, estoque_maximo, ativo, req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar produto', detalhe: String(err) });
  }
};

export const remover = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      'UPDATE produtos SET ativo=false, atualizado_em=NOW() WHERE id=$1 AND empresa_id=$2 RETURNING id',
      [req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }
    res.json({ mensagem: 'Produto desativado' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover produto', detalhe: String(err) });
  }
};

export const historico = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20 } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  try {
    // Garante que o produto pertence à empresa
    const prod = await pool.query('SELECT id FROM produtos WHERE id=$1 AND empresa_id=$2', [req.params.id, empresa_id]);
    if (prod.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }

    const result = await pool.query(
      `SELECT m.*, u.nome as usuario_nome FROM movimentacoes m
       JOIN usuarios u ON u.id = m.usuario_id
       WHERE m.produto_id = $1 ORDER BY m.criado_em DESC LIMIT $2 OFFSET $3`,
      [req.params.id, Number(limite), offset]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar histórico', detalhe: String(err) });
  }
};

export const abaixoMinimo = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT p.*, COALESCE(e.quantidade,0) as estoque_atual,
              (p.estoque_minimo - COALESCE(e.quantidade,0)) as quantidade_necessaria
       FROM produtos p LEFT JOIN estoque e ON e.produto_id = p.id
       WHERE p.empresa_id=$1 AND COALESCE(e.quantidade,0) < p.estoque_minimo AND p.ativo=true
       ORDER BY quantidade_necessaria DESC`,
      [empresa_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar alertas', detalhe: String(err) });
  }
};
