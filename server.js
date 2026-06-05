require('dotenv').config();
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
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

// Paths
const DB_PATH = path.join(__dirname, 'db.json');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const UPLOADS_PATH = path.join(__dirname, 'uploads');

// Init DB
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const def = { users: [], orders: [], notifications: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch (e) { return { users: [], orders: [], notifications: [] }; }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Init Config
function initConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const def = {
      pterodactyl: { applicationApiUrl: '', applicationApiKey: '', clientApiUrl: '', clientApiKey: '', panelDomain: '', nodeId: 1, nestId: 1, eggId: 15, allocationId: 1 },
      pricing: { ramPerGb: 5000, cpuPer100: 3000, diskPerGb: 500, databaseSlot: 2000, backupSlot: 1500, resellerMultiplier: 1.5, resellerSlotPrice: 10000 },
      payment: { qrisImage: '', danaNumber: '', gopayNumber: '', ovoNumber: '', shopeepayNumber: '', bankName: '', bankAccount: '', bankHolder: '' },
      branding: { siteName: 'Zhuu Hosting', tagline: 'Hosting Premium, Otomatis, Andal', whatsapp: '', logoUrl: '' }
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(def, null, 2));
  }
}

initConfig();
if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_PATH));

// Session
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'zhuu_hosting_secret_2077',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
};

if (process.env.NODE_ENV !== 'production') {
  try {
    const sessionsDir = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
    sessionConfig.store = new FileStore({ path: sessionsDir, ttl: 86400 * 7, reapInterval: 3600, logFn: () => {} });
  } catch (e) {}
}

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u.email === email && u.provider === 'local');
    if (!user) return done(null, false, { message: 'Email atau password salah.' });
    const match = await bcrypt.compare(password, user.password || '');
    if (!match) return done(null, false, { message: 'Email atau password salah.' });
    if (user.email === process.env.OWNER_EMAIL) user.role = 'owner';
    return done(null, user);
  } catch (e) { return done(e); }
}));

// OAuth helper
function handleOAuth(provider, profile, email, username, avatar, done) {
  try {
    const db = readDb();
    let user = db.users.find(u => u.provider === provider && u.providerId === profile.id);
    if (!user && email) user = db.users.find(u => u.email === email);
    if (!user) {
      const role = email === process.env.OWNER_EMAIL ? 'owner' : 'user';
      user = {
        id: uuidv4(),
        username: username || `user_${Date.now()}`,
        email: email || `${provider}_${profile.id}@zhuu.local`,
        password: null,
        role,
        provider,
        providerId: profile.id,
        avatar: avatar || null,
        createdAt: new Date().toISOString(),
        banned: false,
        servers: [],
        subUsers: []
      };
      db.users.push(user);
      writeDb(db);
    } else {
      let changed = false;
      if (user.provider !== provider || user.providerId !== profile.id) { user.provider = provider; user.providerId = profile.id; changed = true; }
      if (avatar && user.avatar !== avatar) { user.avatar = avatar; changed = true; }
      if (email === process.env.OWNER_EMAIL && user.role !== 'owner') { user.role = 'owner'; changed = true; }
      if (changed) writeDb(db);
    }
    return done(null, user);
  } catch (e) { return done(e); }
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || ''}/auth/google/callback`
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
    handleOAuth('google', profile, email, profile.displayName, avatar, done);
  }));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || ''}/auth/github/callback`,
    scope: ['user:email']
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const avatar = profile.photos && profile.photos[0] ? profile.photos[0].value : null;
    handleOAuth('github', profile, email, profile.username || profile.displayName, avatar, done);
  }));
}

if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
  passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: `${process.env.BASE_URL || ''}/auth/discord/callback`,
    scope: ['identify', 'email']
  }, (accessToken, refreshToken, profile, done) => {
    const email = profile.email || null;
    const avatar = profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null;
    handleOAuth('discord', profile, email, profile.username, avatar, done);
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u.id === id);
    if (!user) return done(null, false);
    if (user.email === process.env.OWNER_EMAIL) user.role = 'owner';
    done(null, user);
  } catch (e) { done(e); }
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/owner', require('./routes/owner'));

// Public config
app.get('/api/config', (req, res) => {
  try {
    const config = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
    const pub = {
      pricing: config.pricing || {},
      payment: {
        qrisImage: config.payment ? config.payment.qrisImage : '',
        danaNumber: config.payment ? config.payment.danaNumber : '',
        gopayNumber: config.payment ? config.payment.gopayNumber : '',
        ovoNumber: config.payment ? config.payment.ovoNumber : '',
        shopeepayNumber: config.payment ? config.payment.shopeepayNumber : '',
        bankName: config.payment ? config.payment.bankName : '',
        bankAccount: config.payment ? config.payment.bankAccount : '',
        bankHolder: config.payment ? config.payment.bankHolder : ''
      },
      branding: config.branding || { siteName: 'Zhuu Hosting', tagline: 'Hosting Premium, Otomatis, Andal' }
    };
    res.json(pub);
  } catch (e) { res.json({ pricing: {}, payment: {}, branding: {} }); }
});

// Notifications shortcut
app.get('/api/notifications', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDb();
  const notifs = db.notifications.filter(n => n.userId === req.user.id).reverse();
  res.json({ notifications: notifs });
});

app.post('/api/notifications/read/:id', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  const db = readDb();
  const n = db.notifications.find(x => x.id === req.params.id && x.userId === req.user.id);
  if (n) { n.read = true; writeDb(db); }
  res.json({ success: true });
});

// Page routes
const { requireLogin, requireAdmin, requireOwner } = require('./middleware/authMiddleware');
const PUBLIC = path.join(__dirname, 'public');

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));
app.get('/order', requireLogin, (req, res) => res.sendFile(path.join(PUBLIC, 'order.html')));
app.get('/dashboard', requireLogin, (req, res) => res.sendFile(path.join(PUBLIC, 'dashboard.html')));
app.get('/admin', requireAdmin, (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/zhuu-owner-secret-2077', requireOwner, (req, res) => res.sendFile(path.join(PUBLIC, 'owner.html')));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Zhuu Hosting server berjalan di port ${PORT}`);
});

module.exports = app;
