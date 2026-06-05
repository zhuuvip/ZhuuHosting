
// Auth helper
function getToken() { return localStorage.getItem('zhuu_token'); }
function setToken(t) { localStorage.setItem('zhuu_token', t); }
function clearToken() { localStorage.removeItem('zhuu_token'); }

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch(e) {
    return { ok: false, data: {} };
  }
}

// ===== ORDER.JS =====
let currentStep = 1;
let selectedType = 'regular';
let selectedPayment = '';
let pricingConfig = {};

async function init() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    pricingConfig = data.pricing || {};
    window._paymentConfig = data.payment || {};
    calculatePrice();
  } catch (e) {
    console.error('Failed to load config', e);
  }
}

function selectType(type) {
  selectedType = type;
  document.getElementById('typeRegular').classList.toggle('selected', type === 'regular');
  document.getElementById('typeReseller').classList.toggle('selected', type === 'reseller');
  document.getElementById('slotsGroup').style.display = type === 'reseller' ? 'block' : 'none';
  calculatePrice();
}

function calculatePrice() {
  const ram = parseInt(document.getElementById('ramSelect').value) || 0;
  const cpu = parseInt(document.getElementById('cpuSelect').value) || 0;
  const disk = parseInt(document.getElementById('diskSelect').value) || 0;
  const db = parseInt(document.getElementById('dbSelect').value) || 0;
  const backup = parseInt(document.getElementById('backupSelect').value) || 0;
  const slots = selectedType === 'reseller' ? (parseInt(document.getElementById('slotsSelect').value) || 0) : 0;

  const p = pricingConfig;
  const ramPerGb = p.ramPerGb || 5000;
  const cpuPer100 = p.cpuPer100 || 3000;
  const diskPerGb = p.diskPerGb || 500;
  const dbSlot = p.databaseSlot || 2000;
  const backupSlot = p.backupSlot || 1500;
  const resMult = p.resellerMultiplier || 1.5;
  const slotPrice = p.resellerSlotPrice || 10000;

  let base = 0;
  if (ram !== 0) base += (ram / 1024) * ramPerGb;
  if (cpu !== 0) base += (cpu / 100) * cpuPer100;
  if (disk !== 0) base += (disk / 1024) * diskPerGb;
  if (db !== 0) base += db * dbSlot;
  if (backup !== 0) base += backup * backupSlot;

  let total = base;
  if (selectedType === 'reseller') {
    total = base * resMult;
    if (slots !== 0) total += slots * slotPrice;
  }

  total = Math.ceil(total);

  const fmt = formatRupiah(total);
  const el1 = document.getElementById('priceTotal');
  const el2 = document.getElementById('priceFinal');
  if (el1) el1.textContent = fmt;
  if (el2) el2.textContent = fmt;

  window._currentPrice = total;
}

function goToStep(step) {
  if (step === 3 && !selectedPayment) {
    // OK to proceed, they pick payment on step 3
  }

  document.getElementById(`stepContent${currentStep}`).classList.remove('active');
  document.getElementById(`step${currentStep}Indicator`).classList.remove('active');

  currentStep = step;

  document.getElementById(`stepContent${currentStep}`).classList.add('active');
  document.getElementById(`step${currentStep}Indicator`).classList.add('active');

  // Mark completed steps
  for (let i = 1; i <= 3; i++) {
    const ind = document.getElementById(`step${i}Indicator`);
    if (i < step) {
      ind.classList.add('completed');
      ind.classList.remove('active');
    } else if (i === step) {
      ind.classList.add('active');
      ind.classList.remove('completed');
    } else {
      ind.classList.remove('active', 'completed');
    }
  }

  // Lines
  for (let i = 1; i <= 2; i++) {
    const line = document.getElementById(`line${i}`);
    if (line) line.classList.toggle('active', i < step);
  }

  // Update final price display
  calculatePrice();
}

function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.payment-card').forEach(c => c.classList.remove('selected'));
  const card = document.getElementById(`pay-${method}`);
  if (card) card.classList.add('selected');

  const pc = window._paymentConfig || {};
  const detailsEl = document.getElementById('paymentDetails');
  const contentEl = document.getElementById('paymentContent');

  let html = '';
  if (method === 'qris' && pc.qrisImage) {
    html = `<p style="color:var(--ocean-teal); font-family:'Cinzel',serif; font-size:0.85rem; margin-bottom:12px;">Scan QRIS berikut:</p>
            <img src="/uploads/${pc.qrisImage}" class="payment-qris-img" alt="QRIS">`;
  } else if (method === 'qris') {
    html = `<p style="color:var(--text-muted);">QRIS belum dikonfigurasi admin. Hubungi admin untuk info pembayaran.</p>`;
  } else if (method === 'bank') {
    html = `<p style="color:var(--ocean-teal); font-family:'Cinzel',serif; font-size:0.85rem; margin-bottom:8px;">Transfer Bank:</p>
            <p class="payment-number">${pc.bankName || '—'}</p>
            <p class="payment-number">${pc.bankAccount || '—'}</p>
            <p style="color:var(--text-muted); font-size:0.85rem;">a.n. ${pc.bankHolder || '—'}</p>`;
  } else {
    const nums = { dana: pc.danaNumber, gopay: pc.gopayNumber, ovo: pc.ovoNumber, shopeepay: pc.shopeepayNumber };
    const labels = { dana: 'Dana', gopay: 'GoPay', ovo: 'OVO', shopeepay: 'ShopeePay' };
    html = `<p style="color:var(--ocean-teal); font-family:'Cinzel',serif; font-size:0.85rem; margin-bottom:8px;">Nomor ${labels[method] || method}:</p>
            <p class="payment-number">${nums[method] || 'Belum dikonfigurasi'}</p>`;
  }

  contentEl.innerHTML = html;
  detailsEl.classList.add('show');
}

// Preview proof image
document.addEventListener('DOMContentLoaded', () => {
  init();

  const proofInput = document.getElementById('paymentProof');
  if (proofInput) {
    proofInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          document.getElementById('proofPreview').src = ev.target.result;
          document.getElementById('previewImg').style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }
});

async function submitOrder() {
  const alertEl = document.getElementById('submitAlert');
  const successEl = document.getElementById('submitSuccess');
  alertEl.classList.remove('show');
  successEl.classList.remove('show');

  if (!selectedPayment) {
    alertEl.textContent = 'Pilih metode pembayaran.';
    alertEl.classList.add('show');
    return;
  }

  const proofFile = document.getElementById('paymentProof').files[0];
  if (!proofFile) {
    alertEl.textContent = 'Upload bukti pembayaran terlebih dahulu.';
    alertEl.classList.add('show');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  const formData = new FormData();
  formData.append('type', selectedType);
  formData.append('ram', document.getElementById('ramSelect').value);
  formData.append('cpu', document.getElementById('cpuSelect').value);
  formData.append('disk', document.getElementById('diskSelect').value);
  formData.append('databases', document.getElementById('dbSelect').value);
  formData.append('backups', document.getElementById('backupSelect').value);
  if (selectedType === 'reseller') {
    formData.append('slots', document.getElementById('slotsSelect').value);
  }
  formData.append('paymentMethod', selectedPayment);
  formData.append('pterodactylUsername', document.getElementById('pterodactylUsername').value.trim());
  formData.append('price', window._currentPrice || 0);
  formData.append('paymentProof', proofFile);

  try {
    const res = await fetch('/api/orders/create', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.success) {
      successEl.textContent = '🎉 ' + data.message;
      successEl.classList.add('show');
      btn.textContent = 'Order Terkirim!';
      setTimeout(() => window.location.href = '/dashboard', 2500);
    } else {
      alertEl.textContent = data.error || 'Gagal mengirim order.';
      alertEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = '🚀 Kirim Order';
    }
  } catch (err) {
    alertEl.textContent = 'Koneksi error. Coba lagi.';
    alertEl.classList.add('show');
    btn.disabled = false;
    btn.textContent = '🚀 Kirim Order';
  }
}
