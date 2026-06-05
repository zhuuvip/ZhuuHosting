const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { requireOwner } = require('../middleware/authMiddleware');
const { testConnection } = require('./pterodactyl');
const { User, Order, Notification, getConfig, saveConfig } = require('../models');

const router = express.Router();
const UPLOADS_PATH = path.join(__dirname, '..', 'uploads');

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

// GET /api/owner/config
router.get('/config', requireOwner, async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ config });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat config.' }); }
});

// POST /api/owner/config
router.post('/config', requireOwner, async (req, res) => {
  try {
    await saveConfig(req.body);
    res.json({ success: true, message: 'Konfigurasi disimpan.' });
  } catch (e) { res.status(500).json({ error: 'Gagal menyimpan konfigurasi.' }); }
});

// POST /api/owner/upload-qris
router.post('/upload-qris', requireOwner, qrisUpload.single('qrisImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File tidak ditemukan.' });
    const config = await getConfig();
    if (!config.payment) config.payment = {};
    config.payment.qrisImage = req.file.filename;
    await saveConfig({ payment: config.payment });
    res.json({ success: true, filename: req.file.filename, url: `/uploads/${req.file.filename}` });
  } catch (e) { res.status(500).json({ error: 'Gagal upload QRIS.' }); }
});

// GET /api/owner/test-pterodactyl
router.get('/test-pterodactyl', requireOwner, async (req, res) => {
  try {
    const config = await getConfig();
    const result = await testConnection(config);
    res.json(result);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// GET /api/owner/stats
router.get('/stats', requireOwner, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [totalUsers, totalOrders, activeServers, activeThisMonth, allOrders] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'active' }),
      Order.find({ status: 'active', confirmedAt: { $gte: startOfMonth } }).lean(),
      Order.find({}).lean()
    ]);
    const monthlyRevenue = activeThisMonth.reduce((s, o) => s + (o.price || 0), 0);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = allOrders.filter(o => o.createdAt && o.createdAt.slice(0, 10) === dateStr).length;
      last7.push({ date: dateStr, count });
    }

    res.json({ totalUsers, totalOrders, activeServers, monthlyRevenue, last7 });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat stats.' }); }
});

// GET /api/owner/all-orders
router.get('/all-orders', requireOwner, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    const orders = await Order.find(query).lean();
    const users = await User.find({}).lean();
    const enriched = orders.map(o => {
      const user = users.find(u => u.id === o.userId);
      return { ...o, user: user ? { username: user.username, email: user.email, role: user.role } : null };
    }).reverse();
    res.json({ orders: enriched });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat orders.' }); }
});

// GET /api/owner/users
router.get('/users', requireOwner, async (req, res) => {
  try {
    const users = await User.find({}).lean();
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json({ users: safeUsers });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat users.' }); }
});

// POST /api/owner/users/role/:id
router.post('/users/role/:id', requireOwner, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'reseller', 'admin', 'owner'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.role = role;
    await user.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal mengubah role.' }); }
});

// POST /api/owner/users/ban/:id
router.post('/users/ban/:id', requireOwner, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.banned = !user.banned;
    await user.save();
    res.json({ success: true, banned: user.banned });
  } catch (e) { res.status(500).json({ error: 'Gagal mengubah status.' }); }
});

// DELETE /api/owner/users/:id
router.delete('/users/:id', requireOwner, async (req, res) => {
  try {
    const result = await User.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'User tidak ditemukan.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal menghapus user.' }); }
});

// POST /api/owner/orders/confirm/:id
router.post('/orders/confirm/:id', requireOwner, async (req, res) => {
  try {
    const { pterodactylServerId } = req.body;
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    order.status = 'active';
    order.pterodactylServerId = pterodactylServerId || null;
    order.confirmedAt = new Date().toISOString();
    const exp = new Date();
    exp.setDate(exp.getDate() + 30);
    order.expiredAt = exp.toISOString();
    await order.save();
    await Notification.create({
      id: uuidv4(), userId: order.userId,
      message: 'Order Anda telah dikonfirmasi oleh owner!',
      read: false, createdAt: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal konfirmasi.' }); }
});

// DELETE /api/owner/orders/:id
router.delete('/orders/:id', requireOwner, async (req, res) => {
  try {
    const result = await Order.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal menghapus order.' }); }
});

// POST /api/owner/users/reset-password/:id
router.post('/users/reset-password/:id', requireOwner, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    user.password = hashed;
    await user.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal reset password.' }); }
});

module.exports = router;
