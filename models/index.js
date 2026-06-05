const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String },
  email: { type: String },
  password: { type: String, default: null },
  role: { type: String, default: 'user' },
  provider: { type: String, default: 'local' },
  providerId: { type: String, default: null },
  avatar: { type: String, default: null },
  createdAt: { type: String, default: () => new Date().toISOString() },
  banned: { type: Boolean, default: false },
  servers: { type: Array, default: [] },
  subUsers: { type: Array, default: [] }
});

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String },
  pterodactylUsername: { type: String },
  type: { type: String, default: 'regular' },
  resources: { type: Object, default: {} },
  price: { type: Number, default: 0 },
  paymentMethod: { type: String },
  paymentProof: { type: String },
  status: { type: String, default: 'pending' },
  pterodactylServerId: { type: String, default: null },
  notes: { type: String },
  createdAt: { type: String, default: () => new Date().toISOString() },
  confirmedAt: { type: String, default: null },
  expiredAt: { type: String, default: null }
});

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String },
  message: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Config = mongoose.model('Config', configSchema);

function getDefaultConfig() {
  return {
    pterodactyl: {
      applicationApiUrl: '', applicationApiKey: '',
      clientApiUrl: '', clientApiKey: '',
      panelDomain: '', nodeId: 1, nestId: 1, eggId: 15, allocationId: 1
    },
    pricing: {
      ramPerGb: 5000, cpuPer100: 3000, diskPerGb: 500,
      databaseSlot: 2000, backupSlot: 1500,
      resellerMultiplier: 1.5, resellerSlotPrice: 10000
    },
    payment: {
      qrisImage: '', danaNumber: '', gopayNumber: '',
      ovoNumber: '', shopeepayNumber: '',
      bankName: '', bankAccount: '', bankHolder: ''
    },
    branding: {
      siteName: 'Zhuu Hosting',
      tagline: 'Hosting Premium, Otomatis, Andal',
      whatsapp: '', logoUrl: ''
    }
  };
}

async function getConfig() {
  try {
    const doc = await Config.findOne({ key: 'main' }).lean();
    return doc ? doc.value : getDefaultConfig();
  } catch (e) {
    return getDefaultConfig();
  }
}

async function saveConfig(updates) {
  try {
    const existing = await getConfig();
    const merged = {
      pterodactyl: { ...(existing.pterodactyl || {}), ...(updates.pterodactyl || {}) },
      pricing: { ...(existing.pricing || {}), ...(updates.pricing || {}) },
      payment: { ...(existing.payment || {}), ...(updates.payment || {}) },
      branding: { ...(existing.branding || {}), ...(updates.branding || {}) }
    };
    await Config.findOneAndUpdate({ key: 'main' }, { value: merged }, { upsert: true, new: true });
    return merged;
  } catch (e) {
    return getDefaultConfig();
  }
}

module.exports = { User, Order, Notification, Config, getConfig, saveConfig, getDefaultConfig };
