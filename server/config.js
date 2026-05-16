function getJwtSecret() {
  return (process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || '').trim();
}

function getSupabaseUrl() {
  return (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
}

function getSupabaseAnonKey() {
  return (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
}

function getAppName() {
  return (process.env.VITE_APP_NAME || 'Taskora').trim();
}

function getAppEnv() {
  return (process.env.VITE_APP_ENV || process.env.NODE_ENV || 'development').trim();
}

module.exports = {
  getAppEnv,
  getAppName,
  getJwtSecret,
  getSupabaseAnonKey,
  getSupabaseUrl,
};
