import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────

export const listarCategorias = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(p.id) as total_produtos
       FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id AND p.ativo = true
       WHERE c.empresa_id = $1 GROUP BY c.id ORDER BY c.nome`,
      [empresa_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao listar categorias', detalhe: String(err) }); }
};

export const criarCategoria = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { nome, descricao } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categorias (id, empresa_id, nome, descricao) VALUES ($1,$2,$3,$4) RETURNING *',
      [uuidv4(), empresa_id, nome, descricao]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao criar categoria', detalhe: String(err) }); }
};

export const atualizarCategoria = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { nome, descricao } = req.body;
  try {
    const result = await pool.query(
      'UPDATE categorias SET nome=$1, descricao=$2 WHERE id=$3 AND empresa_id=$4 RETURNING *',
      [nome, descricao, req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Categoria não encontrada' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao atualizar categoria', detalhe: String(err) }); }
};

export const removerCategoria = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const emUso = await pool.query('SELECT id FROM produtos WHERE categoria_id=$1 AND empresa_id=$2 LIMIT 1', [req.params.id, empresa_id]);
    if (emUso.rows.length > 0) { res.status(409).json({ erro: 'Categoria em uso por produtos' }); return; }
    await pool.query('DELETE FROM categorias WHERE id=$1 AND empresa_id=$2', [req.params.id, empresa_id]);
    res.json({ mensagem: 'Categoria removida' });
  } catch (err) { res.status(500).json({ erro: 'Erro ao remover categoria', detalhe: String(err) }); }
};

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────

export const listarFornecedores = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20, busca, ativo } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  const params: unknown[] = [empresa_id];
  const where: string[] = ['empresa_id = $1'];
  if (busca) { params.push(`%${busca}%`); where.push(`(nome ILIKE $${params.length} OR cnpj ILIKE $${params.length})`); }
  if (ativo !== undefined) { params.push(ativo === 'true'); where.push(`ativo = $${params.length}`); }
  const whereClause = `WHERE ${where.join(' AND ')}`;
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM fornecedores ${whereClause}`, params);
    params.push(Number(limite), offset);
    const result = await pool.query(
      `SELECT * FROM fornecedores ${whereClause} ORDER BY nome LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ dados: result.rows, paginacao: { total: Number(total.rows[0].count), pagina: Number(pagina), limite: Number(limite), paginas: Math.ceil(Number(total.rows[0].count) / Number(limite)) } });
  } catch (err) { res.status(500).json({ erro: 'Erro ao listar fornecedores', detalhe: String(err) }); }
};

export const buscarFornecedorPorId = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query('SELECT * FROM fornecedores WHERE id=$1 AND empresa_id=$2', [req.params.id, empresa_id]);
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Fornecedor não encontrado' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar fornecedor', detalhe: String(err) }); }
};

export const criarFornecedor = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { nome, cnpj, email, telefone, endereco, cidade, estado, cep, contato_nome } = req.body;
  try {
    if (cnpj) {
      const existe = await pool.query('SELECT id FROM fornecedores WHERE cnpj=$1 AND empresa_id=$2', [cnpj, empresa_id]);
      if (existe.rows.length > 0) { res.status(409).json({ erro: 'CNPJ já cadastrado' }); return; }
    }
    const result = await pool.query(
      `INSERT INTO fornecedores (id, empresa_id, nome, cnpj, email, telefone, endereco, cidade, estado, cep, contato_nome)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [uuidv4(), empresa_id, nome, cnpj, email, telefone, endereco, cidade, estado, cep, contato_nome]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao criar fornecedor', detalhe: String(err) }); }
};

export const atualizarFornecedor = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { nome, cnpj, email, telefone, endereco, cidade, estado, cep, contato_nome, ativo } = req.body;
  try {
    const result = await pool.query(
      `UPDATE fornecedores SET nome=$1, cnpj=$2, email=$3, telefone=$4, endereco=$5,
        cidade=$6, estado=$7, cep=$8, contato_nome=$9, ativo=$10, atualizado_em=NOW()
       WHERE id=$11 AND empresa_id=$12 RETURNING *`,
      [nome, cnpj, email, telefone, endereco, cidade, estado, cep, contato_nome, ativo, req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Fornecedor não encontrado' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao atualizar fornecedor', detalhe: String(err) }); }
};

export const removerFornecedor = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    await pool.query('UPDATE fornecedores SET ativo=false, atualizado_em=NOW() WHERE id=$1 AND empresa_id=$2', [req.params.id, empresa_id]);
    res.json({ mensagem: 'Fornecedor desativado' });
  } catch (err) { res.status(500).json({ erro: 'Erro ao remover fornecedor', detalhe: String(err) }); }
};

export const produtosPorFornecedor = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT p.*, COALESCE(e.quantidade, 0) as estoque_atual
       FROM produtos p LEFT JOIN estoque e ON e.produto_id = p.id
       WHERE p.fornecedor_id=$1 AND p.empresa_id=$2 AND p.ativo=true ORDER BY p.nome`,
      [req.params.id, empresa_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar produtos do fornecedor', detalhe: String(err) }); }
};

// ─── ESTOQUE ──────────────────────────────────────────────────────────────────

export const listarEstoque = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20, busca } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  const params: unknown[] = [empresa_id];
  const where: string[] = ['p.empresa_id = $1'];
  if (busca) { params.push(`%${busca}%`); where.push(`(p.nome ILIKE $${params.length} OR p.codigo ILIKE $${params.length})`); }
  const whereClause = `WHERE ${where.join(' AND ')}`;
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM estoque e JOIN produtos p ON p.id=e.produto_id ${whereClause}`, params);
    params.push(Number(limite), offset);
    const result = await pool.query(
      `SELECT e.*, p.nome as produto_nome, p.codigo as produto_codigo, p.unidade_medida,
              p.estoque_minimo, p.estoque_maximo, p.preco_custo, p.preco_venda,
              CASE WHEN e.quantidade <= p.estoque_minimo THEN true ELSE false END as alerta_minimo,
              e.quantidade * p.preco_custo as valor_total_custo,
              e.quantidade * p.preco_venda as valor_total_venda
       FROM estoque e JOIN produtos p ON p.id=e.produto_id
       ${whereClause} ORDER BY p.nome
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ dados: result.rows, paginacao: { total: Number(total.rows[0].count), pagina: Number(pagina), limite: Number(limite), paginas: Math.ceil(Number(total.rows[0].count) / Number(limite)) } });
  } catch (err) { res.status(500).json({ erro: 'Erro ao listar estoque', detalhe: String(err) }); }
};

export const resumoEstoque = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT p.id) as total_produtos,
              SUM(e.quantidade) as total_itens,
              SUM(e.quantidade * p.preco_custo) as valor_total_custo,
              SUM(e.quantidade * p.preco_venda) as valor_total_venda,
              COUNT(CASE WHEN e.quantidade <= p.estoque_minimo THEN 1 END) as produtos_abaixo_minimo,
              COUNT(CASE WHEN e.quantidade = 0 THEN 1 END) as produtos_zerados
       FROM estoque e JOIN produtos p ON p.id=e.produto_id WHERE p.empresa_id=$1 AND p.ativo=true`,
      [empresa_id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar resumo', detalhe: String(err) }); }
};

export const ajustarEstoque = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { produto_id, nova_quantidade, motivo } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Verifica que produto pertence à empresa
    const prod = await client.query('SELECT id FROM produtos WHERE id=$1 AND empresa_id=$2', [produto_id, empresa_id]);
    if (prod.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }

    const est = await client.query('SELECT quantidade FROM estoque WHERE produto_id=$1 FOR UPDATE', [produto_id]);
    const qtdAnterior = Number(est.rows[0].quantidade);

    await client.query('UPDATE estoque SET quantidade=$1, atualizado_em=NOW() WHERE produto_id=$2', [nova_quantidade, produto_id]);
    await client.query(
      `INSERT INTO movimentacoes (id, empresa_id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, motivo, usuario_id)
       VALUES ($1,$2,$3,'ajuste',$4,$5,$6,$7,$8)`,
      [uuidv4(), empresa_id, produto_id, Math.abs(nova_quantidade - qtdAnterior), qtdAnterior, nova_quantidade, motivo, req.usuario!.id]
    );
    await client.query('COMMIT');
    res.json({ mensagem: 'Estoque ajustado', quantidade_anterior: qtdAnterior, nova_quantidade });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao ajustar estoque', detalhe: String(err) });
  } finally { client.release(); }
};

// ─── MOVIMENTAÇÕES ────────────────────────────────────────────────────────────

export const listarMovimentacoes = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20, tipo, produto_id, data_inicio, data_fim } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  const params: unknown[] = [empresa_id];
  const where: string[] = ['m.empresa_id = $1'];
  if (tipo) { params.push(tipo); where.push(`m.tipo = $${params.length}`); }
  if (produto_id) { params.push(produto_id); where.push(`m.produto_id = $${params.length}`); }
  if (data_inicio) { params.push(data_inicio); where.push(`m.criado_em >= $${params.length}::date`); }
  if (data_fim) { params.push(data_fim); where.push(`m.criado_em <= $${params.length}::date`); }
  const whereClause = `WHERE ${where.join(' AND ')}`;
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM movimentacoes m ${whereClause}`, params);
    params.push(Number(limite), offset);
    const result = await pool.query(
      `SELECT m.*, p.nome as produto_nome, p.codigo as produto_codigo,
              u.nome as usuario_nome, f.nome as fornecedor_nome
       FROM movimentacoes m
       JOIN produtos p ON p.id=m.produto_id
       JOIN usuarios u ON u.id=m.usuario_id
       LEFT JOIN fornecedores f ON f.id=m.fornecedor_id
       ${whereClause} ORDER BY m.criado_em DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ dados: result.rows, paginacao: { total: Number(total.rows[0].count), pagina: Number(pagina), limite: Number(limite), paginas: Math.ceil(Number(total.rows[0].count) / Number(limite)) } });
  } catch (err) { res.status(500).json({ erro: 'Erro ao listar movimentações', detalhe: String(err) }); }
};

const registrarMovimento = async (
  req: Request, res: Response,
  tipo: 'entrada' | 'saida'
): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { produto_id, quantidade, motivo, referencia, fornecedor_id, preco_unitario } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = await client.query('SELECT id FROM produtos WHERE id=$1 AND empresa_id=$2', [produto_id, empresa_id]);
    if (prod.rows.length === 0) { res.status(404).json({ erro: 'Produto não encontrado' }); return; }

    const est = await client.query('SELECT quantidade FROM estoque WHERE produto_id=$1 FOR UPDATE', [produto_id]);
    const qtdAnterior = Number(est.rows[0].quantidade);

    if (tipo === 'saida' && qtdAnterior < Number(quantidade)) {
      res.status(400).json({ erro: 'Estoque insuficiente', disponivel: qtdAnterior });
      return;
    }

    const qtdPosterior = tipo === 'entrada' ? qtdAnterior + Number(quantidade) : qtdAnterior - Number(quantidade);
    await client.query('UPDATE estoque SET quantidade=$1, atualizado_em=NOW() WHERE produto_id=$2', [qtdPosterior, produto_id]);

    const result = await client.query(
      `INSERT INTO movimentacoes (id, empresa_id, produto_id, tipo, quantidade, quantidade_anterior,
        quantidade_posterior, motivo, referencia, usuario_id, fornecedor_id, preco_unitario)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [uuidv4(), empresa_id, produto_id, tipo, quantidade, qtdAnterior, qtdPosterior,
       motivo, referencia, req.usuario!.id, fornecedor_id || null, preco_unitario || null]
    );
    await client.query('COMMIT');
    res.status(201).json({ mensagem: `${tipo === 'entrada' ? 'Entrada' : 'Saída'} registrada`, movimentacao: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: `Erro ao registrar ${tipo}`, detalhe: String(err) });
  } finally { client.release(); }
};

export const registrarEntrada = (req: Request, res: Response) => registrarMovimento(req, res, 'entrada');
export const registrarSaida = (req: Request, res: Response) => registrarMovimento(req, res, 'saida');

export const buscarMovimentacaoPorId = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT m.*, p.nome as produto_nome, u.nome as usuario_nome, f.nome as fornecedor_nome
       FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id
       JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN fornecedores f ON f.id=m.fornecedor_id
       WHERE m.id=$1 AND m.empresa_id=$2`,
      [req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Movimentação não encontrada' }); return; }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar movimentação', detalhe: String(err) }); }
};

// ─── ORDENS DE COMPRA ─────────────────────────────────────────────────────────

export const listarOrdens = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { pagina = 1, limite = 20, status, fornecedor_id } = req.query;
  const offset = (Number(pagina) - 1) * Number(limite);
  const params: unknown[] = [empresa_id];
  const where: string[] = ['oc.empresa_id = $1'];
  if (status) { params.push(status); where.push(`oc.status = $${params.length}`); }
  if (fornecedor_id) { params.push(fornecedor_id); where.push(`oc.fornecedor_id = $${params.length}`); }
  const whereClause = `WHERE ${where.join(' AND ')}`;
  try {
    const total = await pool.query(`SELECT COUNT(*) FROM ordens_compra oc ${whereClause}`, params);
    params.push(Number(limite), offset);
    const result = await pool.query(
      `SELECT oc.*, f.nome as fornecedor_nome, u.nome as usuario_nome
       FROM ordens_compra oc JOIN fornecedores f ON f.id=oc.fornecedor_id JOIN usuarios u ON u.id=oc.usuario_id
       ${whereClause} ORDER BY oc.criado_em DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ dados: result.rows, paginacao: { total: Number(total.rows[0].count), pagina: Number(pagina), limite: Number(limite), paginas: Math.ceil(Number(total.rows[0].count) / Number(limite)) } });
  } catch (err) { res.status(500).json({ erro: 'Erro ao listar ordens', detalhe: String(err) }); }
};

export const buscarOrdemPorId = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const ordem = await pool.query(
      `SELECT oc.*, f.nome as fornecedor_nome, u.nome as usuario_nome
       FROM ordens_compra oc JOIN fornecedores f ON f.id=oc.fornecedor_id JOIN usuarios u ON u.id=oc.usuario_id
       WHERE oc.id=$1 AND oc.empresa_id=$2`,
      [req.params.id, empresa_id]
    );
    if (ordem.rows.length === 0) { res.status(404).json({ erro: 'Ordem não encontrada' }); return; }
    const itens = await pool.query(
      `SELECT ioc.*, p.nome as produto_nome, p.codigo as produto_codigo
       FROM itens_ordem_compra ioc JOIN produtos p ON p.id=ioc.produto_id
       WHERE ioc.ordem_compra_id=$1`,
      [req.params.id]
    );
    res.json({ ...ordem.rows[0], itens: itens.rows });
  } catch (err) { res.status(500).json({ erro: 'Erro ao buscar ordem', detalhe: String(err) }); }
};

export const criarOrdem = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { fornecedor_id, observacoes, data_prevista, itens } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    const valorTotal = itens.reduce((s: number, i: { quantidade: number; preco_unitario: number }) => s + i.quantidade * i.preco_unitario, 0);
    const ordem = await client.query(
      `INSERT INTO ordens_compra (id, empresa_id, fornecedor_id, usuario_id, valor_total, observacoes, data_prevista)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, empresa_id, fornecedor_id, req.usuario!.id, valorTotal, observacoes, data_prevista]
    );
    for (const item of itens) {
      await client.query(
        `INSERT INTO itens_ordem_compra (id, ordem_compra_id, produto_id, quantidade, preco_unitario, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [uuidv4(), id, item.produto_id, item.quantidade, item.preco_unitario, item.quantidade * item.preco_unitario]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ mensagem: 'Ordem criada', ordem: ordem.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao criar ordem', detalhe: String(err) });
  } finally { client.release(); }
};

export const atualizarStatusOrdem = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { status } = req.body;
  if (!['rascunho','enviada','aprovada','recebida','cancelada'].includes(status)) {
    res.status(400).json({ erro: 'Status inválido' }); return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE ordens_compra SET status=$1, atualizado_em=NOW() WHERE id=$2 AND empresa_id=$3 RETURNING *',
      [status, req.params.id, empresa_id]
    );
    if (result.rows.length === 0) { res.status(404).json({ erro: 'Ordem não encontrada' }); return; }

    if (status === 'recebida') {
      const itens = await client.query('SELECT * FROM itens_ordem_compra WHERE ordem_compra_id=$1', [req.params.id]);
      for (const item of itens.rows) {
        const est = await client.query('SELECT quantidade FROM estoque WHERE produto_id=$1 FOR UPDATE', [item.produto_id]);
        const qtdAnterior = Number(est.rows[0]?.quantidade || 0);
        const qtdPosterior = qtdAnterior + Number(item.quantidade);
        await client.query('UPDATE estoque SET quantidade=$1, atualizado_em=NOW() WHERE produto_id=$2', [qtdPosterior, item.produto_id]);
        await client.query(
          `INSERT INTO movimentacoes (id, empresa_id, produto_id, tipo, quantidade, quantidade_anterior,
            quantidade_posterior, motivo, referencia, usuario_id, preco_unitario)
           VALUES ($1,$2,$3,'entrada',$4,$5,$6,$7,$8,$9,$10)`,
          [uuidv4(), empresa_id, item.produto_id, item.quantidade, qtdAnterior, qtdPosterior,
           `Recebimento OC #${req.params.id}`, req.params.id, req.usuario!.id, item.preco_unitario]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ mensagem: `Status atualizado para "${status}"`, ordem: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao atualizar status', detalhe: String(err) });
  } finally { client.release(); }
};

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────

export const dashboard = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const [estoque, movs, ordens, alertas] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT p.id) as total_produtos, SUM(e.quantidade*p.preco_custo) as valor_custo, SUM(e.quantidade*p.preco_venda) as valor_venda FROM estoque e JOIN produtos p ON p.id=e.produto_id WHERE p.empresa_id=$1 AND p.ativo=true`, [empresa_id]),
      pool.query(`SELECT tipo, COUNT(*) as total, SUM(quantidade) as quantidade FROM movimentacoes WHERE empresa_id=$1 AND criado_em >= NOW()-INTERVAL '30 days' GROUP BY tipo`, [empresa_id]),
      pool.query(`SELECT status, COUNT(*) as total FROM ordens_compra WHERE empresa_id=$1 GROUP BY status`, [empresa_id]),
      pool.query(`SELECT COUNT(*) as produtos_abaixo_minimo FROM estoque e JOIN produtos p ON p.id=e.produto_id WHERE p.empresa_id=$1 AND e.quantidade<=p.estoque_minimo AND p.ativo=true`, [empresa_id])
    ]);
    res.json({ estoque: estoque.rows[0], movimentacoes_30d: movs.rows, ordens_compra: ordens.rows, alertas: alertas.rows[0] });
  } catch (err) { res.status(500).json({ erro: 'Erro ao gerar dashboard', detalhe: String(err) }); }
};

export const valorizacaoEstoque = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  try {
    const result = await pool.query(
      `SELECT c.nome as categoria, COUNT(p.id) as total_produtos, SUM(e.quantidade) as total_quantidade,
              SUM(e.quantidade*p.preco_custo) as valor_custo, SUM(e.quantidade*p.preco_venda) as valor_venda,
              SUM(e.quantidade*(p.preco_venda-p.preco_custo)) as margem_total
       FROM estoque e JOIN produtos p ON p.id=e.produto_id LEFT JOIN categorias c ON c.id=p.categoria_id
       WHERE p.empresa_id=$1 AND p.ativo=true GROUP BY c.nome ORDER BY valor_venda DESC`,
      [empresa_id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao gerar valorização', detalhe: String(err) }); }
};

export const movimentacoesPorPeriodo = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { data_inicio, data_fim, agrupamento = 'dia' } = req.query;
  const fmt: Record<string, string> = { dia: 'YYYY-MM-DD', semana: 'IYYY-IW', mes: 'YYYY-MM' };
  try {
    const result = await pool.query(
      `SELECT TO_CHAR(criado_em,$1) as periodo, tipo, COUNT(*) as operacoes,
              SUM(quantidade) as quantidade_total, SUM(quantidade*COALESCE(preco_unitario,0)) as valor_total
       FROM movimentacoes WHERE empresa_id=$2
         AND ($3::date IS NULL OR criado_em>=$3::date) AND ($4::date IS NULL OR criado_em<=$4::date)
       GROUP BY periodo, tipo ORDER BY periodo DESC, tipo`,
      [fmt[String(agrupamento)] || fmt.dia, empresa_id, data_inicio || null, data_fim || null]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao gerar relatório', detalhe: String(err) }); }
};

export const produtosMaisMovimentados = async (req: Request, res: Response): Promise<void> => {
  const empresa_id = req.usuario!.empresa_id;
  const { limite = 10, tipo, data_inicio, data_fim } = req.query;
  const params: unknown[] = [empresa_id, Number(limite)];
  const where: string[] = ['m.empresa_id = $1'];
  if (tipo) { params.push(tipo); where.push(`m.tipo = $${params.length}`); }
  if (data_inicio) { params.push(data_inicio); where.push(`m.criado_em >= $${params.length}::date`); }
  if (data_fim) { params.push(data_fim); where.push(`m.criado_em <= $${params.length}::date`); }
  try {
    const result = await pool.query(
      `SELECT p.id, p.codigo, p.nome, COUNT(m.id) as total_movimentacoes,
              SUM(m.quantidade) as quantidade_total, SUM(m.quantidade*COALESCE(m.preco_unitario,0)) as valor_total
       FROM movimentacoes m JOIN produtos p ON p.id=m.produto_id
       WHERE ${where.join(' AND ')}
       GROUP BY p.id, p.codigo, p.nome ORDER BY quantidade_total DESC LIMIT $2`,
      params
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ erro: 'Erro ao gerar relatório', detalhe: String(err) }); }
};
