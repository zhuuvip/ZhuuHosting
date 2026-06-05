const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User } = require('../models');

const router = express.Router();
const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Semua field harus diisi.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Password tidak cocok.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    const existingEmail = await User.findOne({ email });
    if (existingEmail) return res.status(400).json({ error: 'Email sudah terdaftar.' });
    const existingUsername = await User.findOne({ username });
    if (existingUsername) return res.status(400).json({ error: 'Username sudah digunakan.' });

    const hashed = await bcrypt.hash(password, 12);
    const role = email === process.env.OWNER_EMAIL ? 'owner' : 'user';
    await User.create({
      id: uuidv4(), username, email, password: hashed,
      role, provider: 'local', providerId: null, avatar: null,
      createdAt: new Date().toISOString(), banned: false, servers: [], subUsers: []
    });
    res.json({ success: true, message: 'Akun berhasil dibuat! Silakan login.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
});

// POST /auth/login — returns JWT
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info && info.message ? info.message : 'Login gagal.' });
    if (user.banned) return res.status(403).json({ error: 'Akun Anda telah diblokir.' });
    const token = generateToken(user);
    res.json({ success: true, token, redirect: '/dashboard' });
  })(req, res, next);
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  if (req.logout) req.logout(() => {});
  res.json({ success: true });
});

// GET /auth/me — reads Bearer token only
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { password, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/dashboard?token=${token}`);
  }
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/dashboard?token=${token}`);
  }
);

// Discord OAuth
router.get('/discord', passport.authenticate('discord'));
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/login?error=discord' }),
  (req, res) => {
    const token = generateToken(req.user);
    res.redirect(`/dashboard?token=${token}`);
  }
);

module.exports = router;
