import { Router } from 'express';
import { autenticar, autorizar } from '../middleware/auth';
import * as auth from '../controllers/authController';
import * as c from '../controllers/mainController';
import * as produtos from '../controllers/produtosController';

const router = Router();

// ─── AUTH & EMPRESA ───────────────────────────────────────────────────────────
router.post('/auth/registrar', auth.registrar);           // cria conta + empresa
router.post('/auth/login', auth.login);
router.get('/auth/perfil', autenticar, auth.meuPerfil);
router.put('/auth/alterar-senha', autenticar, auth.alterarSenha);

// ─── MINHA EMPRESA ────────────────────────────────────────────────────────────
router.get('/empresa', autenticar, auth.minhaEmpresa);
router.put('/empresa', autenticar, autorizar('admin'), auth.atualizarEmpresa);
router.get('/empresa/usuarios', autenticar, autorizar('admin', 'gerente'), auth.listarUsuarios);
router.post('/empresa/usuarios/convidar', autenticar, autorizar('admin'), auth.convidarUsuario);

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
router.get('/categorias', autenticar, c.listarCategorias);
router.post('/categorias', autenticar, autorizar('admin', 'gerente'), c.criarCategoria);
router.put('/categorias/:id', autenticar, autorizar('admin', 'gerente'), c.atualizarCategoria);
router.delete('/categorias/:id', autenticar, autorizar('admin'), c.removerCategoria);

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────
router.get('/fornecedores', autenticar, c.listarFornecedores);
router.get('/fornecedores/:id', autenticar, c.buscarFornecedorPorId);
router.get('/fornecedores/:id/produtos', autenticar, c.produtosPorFornecedor);
router.post('/fornecedores', autenticar, autorizar('admin', 'gerente'), c.criarFornecedor);
router.put('/fornecedores/:id', autenticar, autorizar('admin', 'gerente'), c.atualizarFornecedor);
router.delete('/fornecedores/:id', autenticar, autorizar('admin'), c.removerFornecedor);

// ─── PRODUTOS ─────────────────────────────────────────────────────────────────
router.get('/produtos', autenticar, produtos.listar);
router.get('/produtos/alertas/abaixo-minimo', autenticar, produtos.abaixoMinimo);
router.get('/produtos/:id', autenticar, produtos.buscarPorId);
router.get('/produtos/:id/historico', autenticar, produtos.historico);
router.post('/produtos', autenticar, autorizar('admin', 'gerente'), produtos.criar);
router.put('/produtos/:id', autenticar, autorizar('admin', 'gerente'), produtos.atualizar);
router.delete('/produtos/:id', autenticar, autorizar('admin'), produtos.remover);

// ─── ESTOQUE ──────────────────────────────────────────────────────────────────
router.get('/estoque', autenticar, c.listarEstoque);
router.get('/estoque/resumo', autenticar, c.resumoEstoque);
router.post('/estoque/ajuste', autenticar, autorizar('admin', 'gerente'), c.ajustarEstoque);

// ─── MOVIMENTAÇÕES ────────────────────────────────────────────────────────────
router.get('/movimentacoes', autenticar, c.listarMovimentacoes);
router.get('/movimentacoes/:id', autenticar, c.buscarMovimentacaoPorId);
router.post('/movimentacoes/entrada', autenticar, c.registrarEntrada);
router.post('/movimentacoes/saida', autenticar, c.registrarSaida);

// ─── ORDENS DE COMPRA ─────────────────────────────────────────────────────────
router.get('/ordens-compra', autenticar, c.listarOrdens);
router.get('/ordens-compra/:id', autenticar, c.buscarOrdemPorId);
router.post('/ordens-compra', autenticar, autorizar('admin', 'gerente'), c.criarOrdem);
router.patch('/ordens-compra/:id/status', autenticar, autorizar('admin', 'gerente'), c.atualizarStatusOrdem);

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────
router.get('/relatorios/dashboard', autenticar, c.dashboard);
router.get('/relatorios/valorizacao-estoque', autenticar, c.valorizacaoEstoque);
router.get('/relatorios/movimentacoes-periodo', autenticar, c.movimentacoesPorPeriodo);
router.get('/relatorios/produtos-mais-movimentados', autenticar, c.produtosMaisMovimentados);

export default router;
