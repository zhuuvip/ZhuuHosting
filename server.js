require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const passport = require('passport');
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
  } catch(e) { return DEFAULT_DB; }
}

function writeDb(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch(e) {}
}

function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2)); return DEFAULT_CONFIG; }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch(e) { return DEFAULT_CONFIG; }
}

function writeConfig(data) {
  try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2)); } catch(e) {}
}

if (!fs.existsSync(UPLOADS_PATH)) { try { fs.mkdirSync(UPLOADS_PATH, { recursive: true }); } catch(e) {} }

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'zhuu_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
  store: process.env.MONGODB_URI ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 24 * 60 * 60 }) : undefined
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const db = readDb();
  const user = db.users.find(u => u.id === id);
  done(null, user || null);
});

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
  const db = readDb();
  const user = db.users.find(u => u.email === email);
  if (!user) return done(null, false, { message: 'Email tidak ditemukan' });
  if (!user.password) return done(null, false, { message: 'Akun ini menggunakan login sosial' });
  if (!bcrypt.compareSync(password, user.password)) return done(null, false, { message: 'Password salah' });
  if (user.banned) return done(null, false, { message: 'Akun dibanned' });
  return done(null, user);
}));

function handleOAuth(accessToken, refreshToken, profile, done) {
  const db = readDb();
  const email = (profile.emails && profile.emails[0]) ? profile.emails[0].value : null;
  const ownerEmail = process.env.OWNER_EMAIL || 'zhuusite@gmail.com';
  let user = db.users.find(u => u.providerId === profile.id && u.provider === profile.provider);
  if (!user && email) user = db.users.find(u => u.email === email);
  if (!user) {
    user = { id: uuidv4(), username: profile.displayName || profile.username || 'User', email: email, password: null, role: email === ownerEmail ? 'owner' : 'user', provider: profile.provider, providerId: profile.id, avatar: (profile.photos && profile.photos[0]) ? profile.photos[0].value : null, createdAt: new Date().toISOString(), banned: false, servers: [], subUsers: [] };
    db.users.push(user);
    writeDb(db);
  } else {
    if (email === ownerEmail) user.role = 'owner';
    writeDb(db);
  }
  return done(null, user);
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'placeholder') {
  passport.use(new GoogleStrategy({ clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, callbackURL: (process.env.BASE_URL || '') + '/auth/google/callback' }, (a,b,profile,done) => { profile.provider='google'; handleOAuth(a,b,profile,done); }));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_ID !== 'placeholder') {
  passport.use(new GitHubStrategy({ clientID: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, callbackURL: (process.env.BASE_URL || '') + '/auth/github/callback' }, (a,b,profile,done) => { profile.provider='github'; handleOAuth(a,b,profile,done); }));
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_ID !== 'placeholder') {
  passport.use(new DiscordStrategy({ clientID: process.env.DISCORD_CLIENT_ID, clientSecret: process.env.DISCORD_CLIENT_SECRET, callbackURL: (process.env.BASE_URL || '') + '/auth/discord/callback', scope: ['identify','email'] }, (a,b,profile,done) => { profile.provider='discord'; handleOAuth(a,b,profile,done); }));
}

const authMiddleware = require("./middleware/authMiddleware");
app.use((req, res, next) => { req.readDb = readDb; req.writeDb = writeDb; req.readConfig = readConfig; req.writeConfig = writeConfig; next(); });

app.use('/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/owner', require('./routes/owner'));
const pteroHelper = require('./routes/pterodactyl');

app.get('/api/config', (req, res) => {
  const config = readConfig();
  res.json({ pricing: config.pricing, payment: { danaNumber: config.payment.danaNumber, gopayNumber: config.payment.gopayNumber, ovoNumber: config.payment.ovoNumber, shopeepayNumber: config.payment.shopeepayNumber, bankName: config.payment.bankName, bankAccount: config.payment.bankAccount, bankHolder: config.payment.bankHolder, qrisImage: config.payment.qrisImage }, branding: config.branding });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  const { password, ...safeUser } = req.user;
  res.json({ loggedIn: true, user: safeUser });
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
