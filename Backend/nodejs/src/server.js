const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  } 
});

// Middleware
app.use(cors());
app.use(express.json());

// DB & Redis clients
const pgPool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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

app.post('/api/auth/register', (req, res) => authRoutes.register(req, res, pgPool));
app.post('/api/auth/login', (req, res) => authRoutes.login(req, res, pgPool));

// Protected routes
app.use('/api/accounts', accountsRoutes(pgPool));
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