const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initDb, runQuery } = require('../db');
const { getJwtSecret } = require('../config');

function safeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

router.post('/signup', async (req, res) => {
  try {
    const db = await initDb();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const { data: existing } = await runQuery(
      db.from('users').select('id').eq('email', email).maybeSingle()
    );
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const { data: user } = await runQuery(
      db.from('users')
        .insert({ name, email, password: hashed })
        .select('id,name,email,created_at')
        .single()
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token: generateToken(user),
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const db = await initDb();
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const { data: user } = await runQuery(
      db.from('users').select('*').eq('email', email).maybeSingle()
    );
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    res.json({
      message: 'Login successful.',
      token: generateToken(user),
      user: safeUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
