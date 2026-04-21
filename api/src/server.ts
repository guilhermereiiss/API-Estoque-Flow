import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1', routes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', versao: '2.0.0-multitenant', timestamp: new Date().toISOString() });
});

app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

app.listen(PORT, () => {
  console.log(`🚀 API Multi-Tenant rodando na porta ${PORT}`);
  console.log(`📋 http://localhost:${PORT}/api/v1`);
});

export default app;
