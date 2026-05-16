// ============================================================
// routes/auth.js – Signup & Login endpoints
// POST /api/auth/signup
// POST /api/auth/login
// ============================================================

const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { initDb } = require('../db');
const { getJwtSecret } = require('../config');

// Helper: generate a JWT token valid for 7 days
function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

// ── POST /api/auth/signup ─────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const db = await initDb();
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists.' });

    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
    ).run(name, email, hashed);

    const newUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token   = generateToken(newUser);

    res.status(201).json({ message: 'Account created successfully.', token, user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const db = await initDb();
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const match = bcrypt.compareSync(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = generateToken(user);
    // Remove password field from response
    const { password: _omit, ...safeUser } = user;

    res.json({ message: 'Login successful.', token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
