require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';

const DB_PATH = path.join('/tmp', 'db.json');
const CONFIG_PATH = path.join('/tmp', 'config.json');
const UPLOADS_PATH = path.join('/tmp', 'uploads');

const DEFAULT_DB = { users: [], orders: [], notifications: [] };
const DEFAULT_CONFIG = {
  pterodactyl: { applicationApiUrl: '', applicationApiKey: '', clientApiUrl: '', clientApiKey: '', panelDomain: '', nodeId: 1, nestId: 1, eggId: 15, allocationId: 1 },
  pricing: { ramPerGb: 5000, cpuPer100: 3000, diskPerGb: 500, databaseSlot: 2000, backupSlot: 1500, resellerMultiplier: 1.5, resellerSlotPrice: 10000 },
  payment: { qrisImage: '', danaNumber: '', gopayNumber: '', ovoNumber: '', shopeepayNumber: '', bankName: '', bankAccount: '', bankHolder: '' },
  branding: { siteName: 'Zhuu Hosting', tagline: 'Hosting Premium, Otomatis, Andal', whatsapp: '', logoUrl: '' }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) { fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2)); return DEFAULT_DB; }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_DB)); }
}

function writeDb(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch(e) {}
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2)); return DEFAULT_CONFIG; }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch(e) { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
}

function writeConfig(data) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2)); } catch(e) {}
}

if (!fs.existsSync(UPLOADS_PATH)) { try { fs.mkdirSync(UPLOADS_PATH, { recursive: true }); } catch(e) {} }

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// JWT Auth Middleware
app.use((req, res, next) => {
  const token = req.cookies && req.cookies['zhuu_token'];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const db = readDb();
      const user = db.users.find(u => u.id === decoded.id);
      if (user) {
        const ownerEmail = process.env.OWNER_EMAIL || 'zhuusite@gmail.com';
        if (user.email === ownerEmail) user.role = 'owner';
        req.user = user;
      }
    } catch(e) {}
  }
  req.isAuthenticated = () => !!req.user;
  req.readDb = readDb;
  req.writeDb = writeDb;
  req.readConfig = readConfig;
  req.writeConfig = writeConfig;
  next();
});

// Passport setup (for OAuth only)
app.use(session({ secret: JWT_SECRET, resave: false, saveUninitialized: false, cookie: { maxAge: 24*60*60*1000 } }));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const db = readDb();
  done(null, db.users.find(u => u.id === id) || null);
});

function setJwtCookie(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('zhuu_token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'none', secure: true });
}

function handleOAuth(accessToken, refreshToken, profile, done) {
  const db = readDb();
  const email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : null;
  const ownerEmail = process.env.OWNER_EMAIL || 'zhuusite@gmail.com';
  let user = db.users.find(u => u.providerId === profile.id && u.provider === profile.provider);
  if (!user && email) user = db.users.find(u => u.email === email);
  if (!user) {
    user = { id: uuidv4(), username: profile.displayName || profile.username || 'User', email, password: null, role: email === ownerEmail ? 'owner' : 'user', provider: profile.provider, providerId: profile.id, avatar: (profile.photos && profile.photos[0]) ? profile.photos[0].value : null, createdAt: new Date().toISOString(), banned: false, servers: [], subUsers: [] };
    db.users.push(user);
    writeDb(db);
  } else {
    if (email === ownerEmail) user.role = 'owner';
    writeDb(db);
  }
  return done(null, user);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'placeholder') {
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: (process.env.BASE_URL||'') + '/auth/google/callback' }, (a,b,p,done) => { p.provider='google'; handleOAuth(a,b,p,done); }));
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'placeholder') {
  passport.use(new GitHubStrategy({ clientID: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, callbackURL: (process.env.BASE_URL||'') + '/auth/github/callback' }, (a,b,p,done) => { p.provider='github'; handleOAuth(a,b,p,done); }));
}
if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_ID !== 'placeholder') {
  passport.use(new DiscordStrategy({ clientID: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET, callbackURL: (process.env.BASE_URL||'') + '/auth/discord/callback', scope: ['identify','email'] }, (a,b,p,done) => { p.provider='discord'; handleOAuth(a,b,p,done); }));
}

const authMiddleware = require('./middleware/authMiddleware');
app.use('/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/owner', require('./routes/owner'));

app.get('/api/config', (req, res) => {
  const config = readConfig();
  res.json({ pricing: config.pricing, payment: { danaNumber: config.payment.danaNumber, gopayNumber: config.payment.gopayNumber, ovoNumber: config.payment.ovoNumber, shopeepayNumber: config.payment.shopeepayNumber, bankName: config.payment.bankName, bankAccount: config.payment.bankAccount, bankHolder: config.payment.bankHolder, qrisImage: config.payment.qrisImage }, branding: config.branding });
});

app.get('/api/auth/me', (req, res) => {
  // Check JWT from Authorization header OR cookie
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const db = readDb();
      const user = db.users.find(u => u.id === decoded.id);
      if (user) {
        const { password, ...safeUser } = user;
        const ownerEmail = process.env.OWNER_EMAIL || 'zhuusite@gmail.com';
        if (user.email === ownerEmail) safeUser.role = 'owner';
        return res.json({ loggedIn: true, user: safeUser });
      }
    } catch(e) {}
  }
  if (!req.user) return res.json({ loggedIn: false });
  const { password, ...safeUser } = req.user;
  res.json({ loggedIn: true, user: safeUser });
});

// Set JWT cookie after OAuth
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=google' }), (req, res) => {
  setJwtCookie(res, req.user);
  res.redirect('/dashboard');
});
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login?error=github' }), (req, res) => {
  setJwtCookie(res, req.user);
  res.redirect('/dashboard');
});
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/login?error=discord' }), (req, res) => {
  setJwtCookie(res, req.user);
  res.redirect('/dashboard');
});

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/order', authMiddleware.requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'order.html')));
app.get('/dashboard', authMiddleware.requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', authMiddleware.requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/zhuu-owner-secret-2077', authMiddleware.requireOwner, (req, res) => res.sendFile(path.join(__dirname, 'public', 'owner.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log('Zhuu Hosting running on port ' + PORT));
module.exports = app;
