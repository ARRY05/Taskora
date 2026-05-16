require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const { getAppEnv, getAppName, getJwtSecret, getSupabaseAnonKey, getSupabaseUrl } = require('./config');

const app = express();
let dbReady = false;
let dbError = null;

function getHealth() {
  return {
    status: dbReady ? 'ok' : 'degraded',
    app: getAppName(),
    env: getAppEnv(),
    hasJwtSecret: Boolean(getJwtSecret()),
    hasSupabaseConfig: Boolean(getSupabaseUrl() && getSupabaseAnonKey()),
    dbReady,
    dbError,
    timestamp: new Date().toISOString(),
  };
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => {
  res.json(getHealth());
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function checkDatabase() {
  if (!getJwtSecret()) {
    console.error('Missing required environment variable: JWT_SECRET or JWT_SECRET_KEY');
  }
  if (!getSupabaseUrl() || !getSupabaseAnonKey()) {
    console.error('Missing Supabase variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY');
  }

  try {
    await initDb();
    dbReady = true;
    dbError = null;
    console.log('Database ready.');
  } catch (err) {
    dbReady = false;
    dbError = err.message;
    console.error('Database is not ready:', err);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Taskora Server running on port ${PORT}`);
  checkDatabase();
});
