function getJwtSecret() {
  return (process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || '').trim();
}

module.exports = { getJwtSecret };
