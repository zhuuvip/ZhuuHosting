const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { requireOwner } = require('../middleware/authMiddleware');
const { testConnection } = require('./pterodactyl');

const router = express.Router();
const CONFIG_PATH = path.join('/tmp', 'config.json');
const DB_PATH = path.join('/tmp', 'db.json');
const UPLOADS_PATH = path.join('/tmp', 'uploads');

const qrisStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true });
    cb(null, UPLOADS_PATH);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `qris_${Date.now()}${ext}`);
  }
});
const qrisUpload = multer({ storage: qrisStorage, limits: { fileSize: 3 * 1024 * 1024 } });

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return null;
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function writeConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function readDb() {
  if (!fs.existsSync(DB_PATH)) return { users: [], orders: [], notifications: [] };
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// GET /api/owner/config
router.get('/config', requireOwner, (req, res) => {
  const config = readConfig();
  res.json({ config });
});

// POST /api/owner/config
router.post('/config', requireOwner, (req, res) => {
  try {
    const existing = readConfig() || {};
    const updated = {
      pterodactyl: { ...(existing.pterodactyl || {}), ...(req.body.pterodactyl || {}) },
      pricing: { ...(existing.pricing || {}), ...(req.body.pricing || {}) },
      payment: { ...(existing.payment || {}), ...(req.body.payment || {}) },
      branding: { ...(existing.branding || {}), ...(req.body.branding || {}) }
    };
    writeConfig(updated);
    res.json({ success: true, message: 'Konfigurasi disimpan.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi.' });
  }
});

// POST /api/owner/upload-qris
router.post('/upload-qris', requireOwner, qrisUpload.single('qrisImage'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
    const config = readConfig() || {};
    if (!config.payment) config.payment = {};
    config.payment.qrisImage = req.file.filename;
    writeConfig(config);
    res.json({ success: true, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal upload QRIS.' });
  }
});

// GET /api/owner/test-pterodactyl
router.get('/test-pterodactyl', requireOwner, async (req, res) => {
  const config = readConfig();
  if (!config) return res.status(400).json({ error: 'Config belum ada.' });
  const result = await testConnection(config);
  res.json(result);
});

// GET /api/owner/stats
router.get('/stats', requireOwner, (req, res) => {
  const db = readDb();
  const totalUsers = db.users.length;
  const totalOrders = db.orders.length;
  const activeServers = db.orders.filter(o => o.status === 'active').length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = db.orders
    .filter(o => o.status === 'active' && o.confirmedAt && new Date(o.confirmedAt) >= startOfMonth)
    .reduce((sum, o) => sum + (o.price || 0), 0);

  // Orders last 7 days
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = db.orders.filter(o => o.createdAt && o.createdAt.slice(0, 10) === dateStr).length;
    last7.push({ date: dateStr, count });
  }

  res.json({ totalUsers, totalOrders, activeServers, monthlyRevenue, last7 });
});

// GET /api/owner/all-orders
router.get('/all-orders', requireOwner, (req, res) => {
  const db = readDb();
  const { status } = req.query;
  let orders = db.orders;
  if (status && status !== 'all') orders = orders.filter(o => o.status === status);
  const enriched = orders.map(o => {
    const user = db.users.find(u => u.id === o.userId);
    return { ...o, user: user ? { username: user.username, email: user.email, role: user.role } : null };
  }).reverse();
  res.json({ orders: enriched });
});

// GET /api/owner/users
router.get('/users', requireOwner, (req, res) => {
  const db = readDb();
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json({ users: safeUsers });
});

// POST /api/owner/users/role/:id
router.post('/users/role/:id', requireOwner, (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'reseller', 'admin', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    const db = readDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.role = role;
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah role.' });
  }
});

// POST /api/owner/users/ban/:id
router.post('/users/ban/:id', requireOwner, (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.banned = !user.banned;
    writeDb(db);
    res.json({ success: true, banned: user.banned });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah status.' });
  }
});

// DELETE /api/owner/users/:id
router.delete('/users/:id', requireOwner, (req, res) => {
  try {
    const db = readDb();
    const idx = db.users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan.' });
    db.users.splice(idx, 1);
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus user.' });
  }
});

// POST /api/owner/orders/confirm/:id — manual confirm with optional server ID
router.post('/orders/confirm/:id', requireOwner, (req, res) => {
  try {
    const { pterodactylServerId } = req.body;
    const db = readDb();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    order.status = 'active';
    order.pterodactylServerId = pterodactylServerId || null;
    order.confirmedAt = new Date().toISOString();
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    order.expiredAt = exp.toISOString();
    db.notifications.push({
      id: require('uuid').v4(),
      userId: order.userId,
      message: 'Order Anda telah dikonfirmasi oleh owner!',
      read: false,
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal konfirmasi.' });
  }
});

// DELETE /api/owner/orders/:id
router.delete('/orders/:id', requireOwner, (req, res) => {
  try {
    const db = readDb();
    const idx = db.orders.findIndex(o => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    db.orders.splice(idx, 1);
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus order.' });
  }
});

// POST /api/owner/users/reset-password/:id
router.post('/users/reset-password/:id', requireOwner, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 12);
    const db = readDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.password = hashed;
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal reset password.' });
  }
});

module.exports = router;
