const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
}

const allowedOrigins = new Set([FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000']);
const corsOptions = {
  origin(origin, callback) {
    if (NODE_ENV !== 'production') {
      if (!origin) return callback(null, true);

      try {
        const parsedOrigin = new URL(origin);
        const isDevFrontendPort = parsedOrigin.port === '3000';
        const isLocalhost = ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname);
        const isPrivateLan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(parsedOrigin.hostname);

        if (isDevFrontendPort && (isLocalhost || isPrivateLan)) {
          return callback(null, true);
        }
      } catch (err) {
        return callback(new Error('Invalid CORS origin'));
      }
    }

    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: corsOptions,
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors(corsOptions));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication requests. Please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

app.use('/api', apiLimiter);

// DB & Redis clients
const pgPool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test database connection
pgPool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();
  }
});

// Redis (optional - will work without Redis)
let redis = null;
try {
  redis = new Redis(process.env.REDIS_URL);
  redis.on('connect', () => console.log('✅ Redis connected'));
  redis.on('error', (err) => console.log('⚠️ Redis not available:', err.message));
} catch (e) {
  console.log('⚠️ Redis not configured, skipping...');
}

// ---------- Routes ----------
const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const dashboardRoutes = require('./routes/dashboard');

app.post('/api/auth/register', authLimiter, (req, res) => authRoutes.register(req, res, pgPool));
app.post('/api/auth/login', authLimiter, (req, res) => authRoutes.login(req, res, pgPool));

// Protected routes
app.use('/api/accounts', accountsRoutes(pgPool, redis));
app.use('/api/dashboard', dashboardRoutes(pgPool, redis));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WebSocket connection
io.on('connection', (socket) => {
  console.log('🟢 Client connected:', socket.id);
  
  socket.on('authenticate', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`🔐 User ${userId} joined their room`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

// Redis subscriber for trade updates (from Python sync)
if (redis) {
  const subscriber = new Redis(process.env.REDIS_URL);
  subscriber.subscribe('trade_updates');
  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      // data: { accountId, userId, trade, summary }
      io.to(`user:${data.userId}`).emit('trade_update', data);
      console.log('📨 Trade update sent to user:', data.userId);
    } catch (e) {
      console.error('❌ Redis message error:', e);
    }
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const gracefulShutdown = async () => {
  try {
    await pgPool.end();
  } catch (err) {
    console.error('Error closing DB pool:', err);
  }
  try {
    if (redis) {
      await redis.quit();
    }
  } catch (err) {
    console.error('Error closing Redis client:', err);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);