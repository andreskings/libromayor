const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const empresasRouter = require('./routes/empresas');
const registrosRouter = require('./routes/registros');
const totalesRouter = require('./routes/totales');
const balancesRouter = require('./routes/balances');
const tiposRouter = require('./routes/tipos');

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/empresas', authMiddleware, empresasRouter);
app.use('/api/registros', authMiddleware, registrosRouter);
app.use('/api/totales', authMiddleware, totalesRouter);
app.use('/api/balances', authMiddleware, balancesRouter);
app.use('/api/tipos', authMiddleware, tiposRouter);

app.use((err, _req, res, _next) => {
  console.error('[API ERROR]', err);
  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor'
  });
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
