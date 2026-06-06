const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { requireLogin, requireAdmin } = require('../middleware/authMiddleware');
const { User, Order, Notification } = require('../models');

const router = express.Router();
const UPLOADS_PATH = '/tmp/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH, { recursive: true });
    cb(null, UPLOADS_PATH);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${Date.now()}_${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image\/(jpeg|png|jpg|gif|webp)/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'));
  }
});

// GET /api/orders
router.get('/', requireLogin, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).lean();
    res.json({ orders });
  } catch (e) { res.status(500).json({ error: 'Gagal memuat order.' }); }
});

// POST /api/orders/create
router.post('/create', requireLogin, upload.single('paymentProof'), async (req, res) => {
  try {
    const { type, ram, cpu, disk, databases, backups, slots, paymentMethod, pterodactylUsername, price } = req.body;
    if (!type || !ram || !cpu || !disk || !paymentMethod || !pterodactylUsername) {
      return res.status(400).json({ error: 'Field tidak lengkap.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Bukti pembayaran harus diupload.' });

    const parsedPrice = parseFloat(price) || 0;
    const order = await Order.create({
      id: uuidv4(),
      userId: req.user.id,
      pterodactylUsername: pterodactylUsername.trim(),
      type: type === 'reseller' ? 'reseller' : 'regular',
      resources: {
        ram: ram.toString(), cpu: cpu.toString(), disk: disk.toString(),
        databases: databases ? databases.toString() : '1',
        backups: backups ? backups.toString() : '1',
        slots: type === 'reseller' ? (slots ? slots.toString() : '5') : '0'
      },
      price: parsedPrice,
      paymentMethod,
      paymentProof: req.file.filename,
      status: 'pending',
      pterodactylServerId: null,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      expiredAt: null
    });

    // Notify admins
    const admins = await User.find({ role: { $in: ['admin', 'owner'] } }).lean();
    const notifDocs = admins.map(admin => ({
      id: uuidv4(), userId: admin.id,
      message: `Order baru dari ${req.user.username} (${type}) - Rp${parsedPrice.toLocaleString()}`,
      read: false, createdAt: new Date().toISOString()
    }));
    if (notifDocs.length > 0) await Notification.insertMany(notifDocs);

    res.json({ success: true, message: 'Order berhasil dikirim! Menunggu konfirmasi admin.', orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat order.' });
  }
});

// POST /api/orders/confirm/:id
router.post('/confirm/:id', requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order sudah diproses.' });

    const pteroResult = await require('./pterodactyl').deployServer(order.toObject());

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 30);

    if (pteroResult.success) {
      order.status = 'active';
      order.pterodactylServerId = pteroResult.serverId;
      order.confirmedAt = new Date().toISOString();
      order.expiredAt = expDate.toISOString();
      await order.save();
      await Notification.create({
        id: uuidv4(), userId: order.userId,
        message: `Order Anda telah dikonfirmasi! Server ID: ${pteroResult.serverId || 'Manual'}`,
        read: false, createdAt: new Date().toISOString()
      });
    } else {
      order.status = 'active';
      order.confirmedAt = new Date().toISOString();
      order.expiredAt = expDate.toISOString();
      order.notes = pteroResult.error || 'Auto-deploy skipped, manual setup required';
      await order.save();
      await Notification.create({
        id: uuidv4(), userId: order.userId,
        message: 'Order Anda telah dikonfirmasi! Admin akan setup server Anda segera.',
        read: false, createdAt: new Date().toISOString()
      });
    }

    res.json({ success: true, message: 'Order dikonfirmasi.', serverId: order.pterodactylServerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengkonfirmasi order.' });
  }
});

// POST /api/orders/reject/:id
router.post('/reject/:id', requireAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    order.status = 'rejected';
    await order.save();
    await Notification.create({
      id: uuidv4(), userId: order.userId,
      message: 'Order Anda telah ditolak. Silakan hubungi admin untuk informasi lebih lanjut.',
      read: false, createdAt: new Date().toISOString()
    });
    res.json({ success: true, message: 'Order ditolak.' });
  } catch (err) { res.status(500).json({ error: 'Gagal menolak order.' }); }
});

// DELETE /api/orders/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const result = await Order.deleteOne({ id: req.params.id });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Gagal menghapus order.' }); }
});

module.exports = router;
