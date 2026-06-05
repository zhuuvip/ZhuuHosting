const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { requireLogin, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const DB_PATH = path.join(__dirname, '..', 'db.json');
const UPLOADS_PATH = path.join(__dirname, '..', 'uploads');

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

// GET /api/orders — user's own orders
router.get('/', requireLogin, (req, res) => {
  const db = readDb();
  const orders = db.orders.filter(o => o.userId === req.user.id);
  res.json({ orders });
});

// POST /api/orders/create — create new order
router.post('/create', requireLogin, upload.single('paymentProof'), (req, res) => {
  try {
    const { type, ram, cpu, disk, databases, backups, slots, paymentMethod, pterodactylUsername, price } = req.body;
    if (!type || !ram || !cpu || !disk || !paymentMethod || !pterodactylUsername) {
      return res.status(400).json({ error: 'Field tidak lengkap.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Bukti pembayaran harus diupload.' });
    }
    const db = readDb();
    const parsedPrice = parseFloat(price) || 0;
    const order = {
      id: uuidv4(),
      userId: req.user.id,
      pterodactylUsername: pterodactylUsername.trim(),
      type: type === 'reseller' ? 'reseller' : 'regular',
      resources: {
        ram: ram.toString(),
        cpu: cpu.toString(),
        disk: disk.toString(),
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
    };
    db.orders.push(order);
    // Notify admins
    const admins = db.users.filter(u => u.role === 'admin' || u.role === 'owner');
    admins.forEach(admin => {
      db.notifications.push({
        id: uuidv4(),
        userId: admin.id,
        message: `Order baru dari ${req.user.username} (${type}) - Rp${parsedPrice.toLocaleString()}`,
        read: false,
        createdAt: new Date().toISOString()
      });
    });
    writeDb(db);
    res.json({ success: true, message: 'Order berhasil dikirim! Menunggu konfirmasi admin.', orderId: order.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal membuat order.' });
  }
});

// POST /api/orders/confirm/:id — admin confirm + auto-deploy
router.post('/confirm/:id', requireAdmin, async (req, res) => {
  try {
    const db = readDb();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    if (order.status !== 'pending') return res.status(400).json({ error: 'Order sudah diproses.' });

    const pteroResult = await require('./pterodactyl').deployServer(order, db);

    if (pteroResult.success) {
      order.status = 'active';
      order.pterodactylServerId = pteroResult.serverId;
      order.confirmedAt = new Date().toISOString();
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);
      order.expiredAt = expDate.toISOString();

      db.notifications.push({
        id: uuidv4(),
        userId: order.userId,
        message: `Order Anda telah dikonfirmasi! Server ID: ${pteroResult.serverId || 'Manual'}`,
        read: false,
        createdAt: new Date().toISOString()
      });
    } else {
      order.status = 'active';
      order.confirmedAt = new Date().toISOString();
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);
      order.expiredAt = expDate.toISOString();
      order.notes = pteroResult.error || 'Auto-deploy skipped, manual setup required';

      db.notifications.push({
        id: uuidv4(),
        userId: order.userId,
        message: 'Order Anda telah dikonfirmasi! Admin akan setup server Anda segera.',
        read: false,
        createdAt: new Date().toISOString()
      });
    }

    writeDb(db);
    res.json({ success: true, message: 'Order dikonfirmasi.', serverId: order.pterodactylServerId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Gagal mengkonfirmasi order.' });
  }
});

// POST /api/orders/reject/:id — admin reject
router.post('/reject/:id', requireAdmin, (req, res) => {
  try {
    const db = readDb();
    const order = db.orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan.' });
    order.status = 'rejected';
    db.notifications.push({
      id: uuidv4(),
      userId: order.userId,
      message: 'Order Anda telah ditolak. Silakan hubungi admin untuk informasi lebih lanjut.',
      read: false,
      createdAt: new Date().toISOString()
    });
    writeDb(db);
    res.json({ success: true, message: 'Order ditolak.' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menolak order.' });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', requireAdmin, (req, res) => {
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

// GET /api/notifications
router.get('/notifications', requireLogin, (req, res) => {
  const db = readDb();
  const notifs = db.notifications.filter(n => n.userId === req.user.id).reverse();
  res.json({ notifications: notifs });
});

// POST /api/notifications/read/:id
router.post('/notifications/read/:id', requireLogin, (req, res) => {
  const db = readDb();
  const notif = db.notifications.find(n => n.id === req.params.id && n.userId === req.user.id);
  if (notif) { notif.read = true; writeDb(db); }
  res.json({ success: true });
});

module.exports = router;
