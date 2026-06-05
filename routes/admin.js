const express = require('express');
const { requireAdmin } = require('../middleware/authMiddleware');
const { User, Order, Notification } = require('../models');

const router = express.Router();

// GET /api/admin/users
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).lean();
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json({ users: safeUsers });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat users.' }); }
});

// GET /api/admin/orders
router.get('/orders', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    const orders = await Order.find(query).lean();
    const users = await User.find({}).lean();
    const ordersWithUser = orders.map(o => {
      const user = users.find(u => u.id === o.userId);
      return { ...o, user: user ? { username: user.username, email: user.email } : null };
    });
    res.json({ orders: ordersWithUser });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat orders.' }); }
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [totalUsers, pendingOrders, activeServers, activeThisMonth] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'active' }),
      Order.find({ status: 'active', confirmedAt: { $gte: startOfMonth } }).lean()
    ]);
    const monthlyRevenue = activeThisMonth.reduce((s, o) => s + (o.price || 0), 0);
    res.json({ totalUsers, pendingOrders, activeServers, monthlyRevenue });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat stats.' }); }
});

// POST /api/admin/users/role/:id
router.post('/users/role/:id', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'reseller', 'admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Role tidak valid.' });
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (user.email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa mengubah role owner.' });
    user.role = role;
    await user.save();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal mengubah role.' }); }
});

// POST /api/admin/users/ban/:id
router.post('/users/ban/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (user.email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa memblokir owner.' });
    user.banned = !user.banned;
    await user.save();
    res.json({ success: true, banned: user.banned });
  } catch (e) { res.status(500).json({ error: 'Gagal memperbarui status ban.' }); }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
    if (user.email === process.env.OWNER_EMAIL) return res.status(403).json({ error: 'Tidak bisa menghapus owner.' });
    await User.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Gagal menghapus user.' }); }
});

module.exports = router;
