import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import archersRoutes from './routes/archers.js';
import scheduleRoutes from './routes/schedule.js';
import planningRoutes from './routes/planning.js';
import trainingTypesRoutes from './routes/trainingTypes.js';
import statsRoutes from './routes/stats.js';
import pushRoutes  from './routes/push.js';

const app = express();

// Accepte plusieurs origines séparées par des virgules (ex. local + Vercel)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => {
    // Autoriser les requêtes sans origin (Postman, Render health checks…)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    // Retourner false (403) au lieu de lever une erreur (500)
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/archers', archersRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/training-types', trainingTypesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/push',  pushRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
