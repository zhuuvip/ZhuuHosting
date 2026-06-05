const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'db.json');

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const def = { users: [], orders: [], notifications: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// GET /api/users — all users
router.get('/users', requireAdmin, (req, res) => {
  const db = readDb();
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json({ users: safeUsers });
});

// GET /api/admin/orders — all orders
router.get('/orders', requireAdmin, (req, res) => {
  const db = readDb();
  const { status } = req.query;
  let orders = db.orders;
  if (status && status !== 'all') {
    orders = orders.filter(o => o.status === status);
  }
  const ordersWithUser = orders.map(o => {
    const user = db.users.find(u => u.id === o.userId);
    return { ...o, user: user ? { username: user.username, email: user.email } : null };
  });
  res.json({ orders: ordersWithUser });
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, (req, res) => {
  const db = readDb();
  const totalUsers = db.users.length;
  const pendingOrders = db.orders.filter(o => o.status === 'pending').length;
  const activeServers = db.orders.filter(o => o.status === 'active').length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = db.orders
    .filter(o => o.status === 'active' && new Date(o.confirmedAt) >= startOfMonth)
    .reduce((sum, o) => sum + (o.price || 0), 0);

  res.json({ totalUsers, pendingOrders, activeServers, monthlyRevenue });
});

// POST /api/users/role/:id — change role
router.post('/users/role/:id', requireAdmin, (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'reseller', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    const db = readDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (user.email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa mengubah role owner.' });
    user.role = role;
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengubah role.' });
  }
});

// POST /api/users/ban/:id — ban/unban
router.post('/users/ban/:id', requireAdmin, (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (user.email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa memblokir owner.' });
    user.banned = !user.banned;
    writeDb(db);
    res.json({ success: true, banned: user.banned });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui status ban.' });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const db = readDb();
    const idx = db.users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (db.users[idx].email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa menghapus owner.' });
    db.users.splice(idx, 1);
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus user.' });
  }
});

module.exports = router;
