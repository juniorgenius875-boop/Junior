import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { connectDb } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import studyRoutes from './routes/study.js';
import juniorRoutes from './routes/junior.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import { predictionModelInfo } from './services/prediction.js';
import dns from 'dns';
dns.setServers(["8.8.8.8", "1.1.1.1"]);

await connectDb();
const app=express();
app.disable('x-powered-by');
const normalizeOrigin = origin => String(origin || '').trim().replace(/\/+$/, '');
const isLocalDevelopmentOrigin = origin => {
  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    const explicitlyAllowed = config.corsOrigins.includes(normalizedOrigin);
    const localDevelopment = process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(normalizedOrigin);

    if (explicitlyAllowed || localDevelopment) return cb(null, true);

    console.warn(`CORS blocked origin: ${origin}. Allowed origins: ${config.corsOrigins.join(', ')}`);
    return cb(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json({limit:'2mb'}));
app.use((req,res,next)=>{const start=Date.now();res.on('finish',()=>console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now()-start}ms`));next();});
app.get('/',(_req,res)=>res.json({message:'BoardTrack + Junior API is running',database:'mongodb',backend:'node',ml:{loaded:true,...predictionModelInfo}}));
app.get('/health',(_req,res)=>res.json({status:'ok',database:'mongodb',ml_loaded:true}));
app.use('/api/auth',authRoutes);
app.use('/api/profile',profileRoutes);
app.use('/api/study',studyRoutes);
app.use('/api',juniorRoutes);
app.use('/api/reports',reportRoutes);
app.use('/api/admin',adminRoutes);
app.use((req,res)=>res.status(404).json({message:'Route not found'}));
app.use((error,_req,res,_next)=>{console.error(error);res.status(error?.name==='ValidationError'?400:500).json({message:error.message||'Internal server error'});});
app.listen(config.port,()=>console.log(`BoardTrack + Junior API listening on ${config.port}`));
