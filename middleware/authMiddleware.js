const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join('/tmp', 'config.json');

function requireLogin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  if (req.user.role === 'admin' || req.user.role === 'owner') {
    return next();
  }
  res.redirect('/dashboard');
}

function requireOwner(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  if (req.user.email === process.env.OWNER_EMAIL) {
    req.user.role = 'owner';
    return next();
  }
  res.redirect('/dashboard');
}

function attachConfig(req, res, next) {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
      req.config = JSON.parse(raw);
    } else {
      req.config = getDefaultConfig();
    }
  } catch (e) {
    req.config = getDefaultConfig();
  }
  next();
}

function getDefaultConfig() {
  return {
    pterodactyl: {
      applicationApiUrl: '',
      applicationApiKey: '',
      clientApiUrl: '',
      clientApiKey: '',
      panelDomain: '',
      nodeId: 1,
      nestId: 1,
      eggId: 15,
      allocationId: 1
    },
    pricing: {
      ramPerGb: 5000,
      cpuPer100: 3000,
      diskPerGb: 500,
      databaseSlot: 2000,
      backupSlot: 1500,
      resellerMultiplier: 1.5,
      resellerSlotPrice: 10000
    },
    payment: {
      qrisImage: '',
      danaNumber: '',
      gopayNumber: '',
      ovoNumber: '',
      shopeepayNumber: '',
      bankName: '',
      bankAccount: '',
      bankHolder: ''
    },
    branding: {
      siteName: 'Zhuu Hosting',
      tagline: 'Hosting Premium, Otomatis, Andal',
      whatsapp: '',
      logoUrl: ''
    }
  };
}

module.exports = { requireLogin, requireAdmin, requireOwner, attachConfig, getDefaultConfig };
