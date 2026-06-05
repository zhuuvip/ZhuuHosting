const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const DB_PATH = path.join('/tmp', 'db.json');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';
function setJwtCookie(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('zhuu_token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'none', secure: true });
}

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const def = { users: [], orders: [], notifications: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(def, null, 2));
      return def;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) { return { users: [], orders: [], notifications: [] }; }
}

function writeDb(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch(e) {}
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password || !confirmPassword) return res.status(400).json({ error: 'Semua field harus diisi.' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'Password tidak cocok.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    const db = readDb();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email sudah terdaftar.' });
    if (db.users.find(u => u.username === username)) return res.status(400).json({ error: 'Username sudah digunakan.' });
    const hashed = await bcrypt.hash(password, 12);
    const newUser = { id: uuidv4(), username, email, password: hashed, role: email === process.env.OWNER_EMAIL ? 'owner' : 'user', provider: 'local', providerId: null, avatar: null, createdAt: new Date().toISOString(), banned: false, servers: [], subUsers: [] };
    db.users.push(newUser);
    writeDb(db);
    res.json({ success: true, message: 'Akun berhasil dibuat! Silakan login.' });
  } catch (err) { res.status(500).json({ error: 'Terjadi kesalahan server.' }); }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info && info.message ? info.message : 'Login gagal.' });
    if (user.banned) return res.status(403).json({ error: 'Akun Anda telah diblokir.' });
    req.logIn(user, (err2) => {
      if (err2) return next(err2);
      setJwtCookie(res, user);
      const tok = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, redirect: '/dashboard', token: tok });
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => { res.clearCookie('zhuu_token'); req.logout ? req.logout(() => res.redirect('/')) : res.redirect('/'); });

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const { password, ...safeUser } = req.user;
    res.json({ user: safeUser });
  } else { res.status(401).json({ error: 'Not authenticated' }); }
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google' }), (req, res) => res.redirect('/dashboard'));
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback', passport.authenticate('github', { failureRedirect: '/login?error=github' }), (req, res) => res.redirect('/dashboard'));
router.get('/discord', passport.authenticate('discord'));
router.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/login?error=discord' }), (req, res) => res.redirect('/dashboard'));

module.exports = router;
