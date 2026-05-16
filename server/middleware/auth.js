// ============================================================
// auth.js (middleware) – JWT verification
// Protects routes by checking the Authorization header
// ============================================================

const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config');

function authMiddleware(req, res, next) {
  // Expect header: Authorization: Bearer <token>
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;  // { id, name, email }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = authMiddleware;
