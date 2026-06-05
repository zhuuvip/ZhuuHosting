require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';
const UPLOADS_PATH = path.join(__dirname, 'uploads');

// Connect MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err.message));
}

const { User, Order, Notification, Config, getConfig, saveConfig } = require('./models');

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true });

// Core middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_PATH));

// Session (memory only — for OAuth flow)
app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 10 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

// JWT middleware — populates req.user from Bearer token for all API routes
app.use(async (req, res, next) => {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
      const user = await User.findOne({ id: decoded.id }).lean();
      if (user) {
        if (user.email === process.env.OWNER_EMAIL) user.role = 'owner';
        req.user = user;
      }
    } catch (e) {}
  }
  next();
});

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Passport Local Strategy
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const user = await User.findOne({ email, provider: 'local' }).lean();
    if (!user) return done(null, false, { message: 'Email atau password salah.' });
    const match = await bcrypt.compare(password, user.password || '');
    if (!match) return done(null, false, { message: 'Email atau password salah.' });
    if (user.email === process.env.OWNER_EMAIL) user.role = 'owner';
    return done(null, user);
  } catch (e) { return done(e); }
}));

// OAuth helper
async function handleOAuth(provider, profile, email, username, avatar, done) {
  try {
    let user = await User.findOne({ provider, providerId: profile.id }).lean();
    if (!user && email) user = await User.findOne({ email }).lean();
    if (!user) {
      const role = email === process.env.OWNER_EMAIL ? 'owner' : 'user';
      const newUser = {
        id: uuidv4(), username: username || `user_${Date.now()}`,
        email: email || `${provider}_${profile.id}@zhuu.local`,
        password: null, role, provider, providerId: profile.id,
        avatar: avatar || null, createdAt: new Date().toISOString(),
        banned: false, servers: [], subUsers: []
      };
      user = await User.create(newUser);
      user = user.toObject();
    } else {
      const updates = {};
      if (user.provider !== provider || user.providerId !== profile.id) {
        updates.provider = provider; updates.providerId = profile.id;
      }
      if (avatar && user.avatar !== avatar) updates.avatar = avatar;
      if (email === process.env.OWNER_EMAIL && user.role !== 'owner') updates.role = 'owner';
      if (Object.keys(updates).length > 0) {
        user = await User.findOneAndUpdate({ id: user.id }, updates, { new: true }).lean();
      }
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
    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : null;
    handleOAuth('discord', profile, email, profile.username, avatar, done);
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findOne({ id }).lean();
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

// GET /api/auth/me — alias on /api prefix
app.get('/api/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { password, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Public config
app.get('/api/config', async (req, res) => {
  try {
    const config = await getConfig();
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

// Notifications
app.get('/api/notifications', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const notifs = await Notification.find({ userId: req.user.id }).lean();
    res.json({ notifications: notifs.reverse() });
  } catch (e) { res.json({ notifications: [] }); }
});

app.post('/api/notifications/read/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    await Notification.findOneAndUpdate({ id: req.params.id, userId: req.user.id }, { read: true });
    res.json({ success: true });
  } catch (e) { res.json({ success: false }); }
});

// Page routes — serve HTML, JS handles auth
const PUBLIC = path.join(__dirname, 'public');
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));
app.get('/order', (req, res) => res.sendFile(path.join(PUBLIC, 'order.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(PUBLIC, 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/zhuu-owner-secret-2077', (req, res) => res.sendFile(path.join(PUBLIC, 'owner.html')));

// 404
app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, 'index.html')));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Zhuu Hosting berjalan di port ${PORT}`);
});

module.exports = app;

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT:', err.message, err.stack);
});
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED:', err);
});
