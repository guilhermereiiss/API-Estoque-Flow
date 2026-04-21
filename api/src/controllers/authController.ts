import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';

// Registrar: cria empresa + usuário admin dono dela
export const registrar = async (req: Request, res: Response): Promise<void> => {
  const { nome, email, senha, nome_empresa } = req.body;

  if (!nome || !email || !senha || !nome_empresa) {
    res.status(400).json({ erro: 'nome, email, senha e nome_empresa são obrigatórios' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existe = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      res.status(409).json({ erro: 'E-mail já cadastrado' });
      return;
    }

    // Cria a empresa
    const empresaId = uuidv4();
    await client.query(
      'INSERT INTO empresas (id, nome) VALUES ($1, $2)',
      [empresaId, nome_empresa]
    );

    // Cria o usuário como admin da empresa
    const usuarioId = uuidv4();
    const senhaHash = await bcrypt.hash(senha, 12);
    const result = await client.query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       RETURNING id, nome, email, perfil, empresa_id`,
      [usuarioId, empresaId, nome, email, senhaHash]
    );

    await client.query('COMMIT');

    const token = jwt.sign(
      { id: usuarioId, email, perfil: 'admin', empresa_id: empresaId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      mensagem: 'Conta criada com sucesso!',
      token,
      usuario: result.rows[0],
      empresa: { id: empresaId, nome: nome_empresa }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ erro: 'Erro ao registrar', detalhe: String(err) });
  } finally {
    client.release();
  }
};

// Login
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, senha } = req.body;
  try {
    const result = await pool.query(
      `SELECT u.*, e.nome as empresa_nome
       FROM usuarios u
       JOIN empresas e ON e.id = u.empresa_id
       WHERE u.email = $1 AND u.ativo = true`,
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ erro: 'Credenciais inválidas' });
      return;
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaValida) {
      res.status(401).json({ erro: 'Credenciais inválidas' });
      return;
    }

    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, perfil: usuario.perfil, empresa_id: usuario.empresa_id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      empresa: { id: usuario.empresa_id, nome: usuario.empresa_nome }
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao fazer login', detalhe: String(err) });
  }
};

// Meu perfil
export const meuPerfil = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nome, u.email, u.perfil, u.ativo, u.criado_em,
              e.id as empresa_id, e.nome as empresa_nome
       FROM usuarios u JOIN empresas e ON e.id = u.empresa_id
       WHERE u.id = $1`,
      [req.usuario!.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar perfil', detalhe: String(err) });
  }
};

// Convidar usuário para a mesma empresa
export const convidarUsuario = async (req: Request, res: Response): Promise<void> => {
  const { nome, email, senha, perfil = 'operador' } = req.body;
  const empresa_id = req.usuario!.empresa_id;

  try {
    const existe = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
      res.status(409).json({ erro: 'E-mail já cadastrado' });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const result = await pool.query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, perfil)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, perfil`,
      [uuidv4(), empresa_id, nome, email, senhaHash, perfil]
    );

    res.status(201).json({ mensagem: 'Usuário convidado com sucesso', usuario: result.rows[0] });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao convidar usuário', detalhe: String(err) });
  }
};

// Listar usuários da minha empresa
export const listarUsuarios = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT id, nome, email, perfil, ativo, criado_em FROM usuarios WHERE empresa_id = $1 ORDER BY nome',
      [req.usuario!.empresa_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar usuários', detalhe: String(err) });
  }
};

// Alterar senha
export const alterarSenha = async (req: Request, res: Response): Promise<void> => {
  const { senha_atual, nova_senha } = req.body;
  try {
    const result = await pool.query('SELECT senha_hash FROM usuarios WHERE id = $1', [req.usuario!.id]);
    const ok = await bcrypt.compare(senha_atual, result.rows[0].senha_hash);
    if (!ok) { res.status(401).json({ erro: 'Senha atual incorreta' }); return; }
    const hash = await bcrypt.hash(nova_senha, 12);
    await pool.query('UPDATE usuarios SET senha_hash=$1, atualizado_em=NOW() WHERE id=$2', [hash, req.usuario!.id]);
    res.json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao alterar senha', detalhe: String(err) });
  }
};

// Info da minha empresa
export const minhaEmpresa = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT * FROM empresas WHERE id = $1', [req.usuario!.empresa_id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar empresa', detalhe: String(err) });
  }
};

// Atualizar dados da empresa
export const atualizarEmpresa = async (req: Request, res: Response): Promise<void> => {
  const { nome, cnpj, telefone, email_contato, endereco, cidade, estado } = req.body;
  try {
    const result = await pool.query(
      `UPDATE empresas SET nome=$1, cnpj=$2, telefone=$3, email_contato=$4,
        endereco=$5, cidade=$6, estado=$7, atualizado_em=NOW()
       WHERE id=$8 RETURNING *`,
      [nome, cnpj, telefone, email_contato, endereco, cidade, estado, req.usuario!.empresa_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar empresa', detalhe: String(err) });
  }
};
