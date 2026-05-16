// ============================================================
// index.js – Main Express server entry point
// Starts the HTTP server, mounts all routes, serves frontend
// ============================================================

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const { initDb } = require('./db');

const hasJwtSecret = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.trim());
if (!hasJwtSecret) {
  console.error('Missing required environment variable: JWT_SECRET');
}

const app = express();

// ── Middleware ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from the /public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Boot: init DB first, then mount routes & start server ─
async function boot() {
  // sql.js loads a WASM binary – must await before using DB
  await initDb();
  console.log('Database ready.');

  // Mount API routes (each route file also calls initDb internally)
  app.use('/api/auth',      require('./routes/auth'));
  app.use('/api/projects',  require('./routes/projects'));
  app.use('/api/tasks',     require('./routes/tasks'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'Taskora',
      env: process.env.NODE_ENV || 'development',
      hasJwtSecret,
      timestamp: new Date().toISOString()
    });
  });

  // Catch-all: serve index.html (lets frontend handle unknown paths)
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║            Taskora Server            ║
  ║   http://localhost:${PORT}              ║
  ╚══════════════════════════════════════╝
    `);
  });
}

boot().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
