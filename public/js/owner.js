// ===== TOKEN HELPERS =====
function getToken(){return localStorage.getItem('zhuu_token')}
function setToken(t){localStorage.setItem('zhuu_token',t)}
function clearToken(){localStorage.removeItem('zhuu_token')}
async function apiFetch(url,options={}){const token=getToken();const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers['Authorization']='Bearer '+token;try{const res=await fetch(url,{...options,headers});const data=await res.json().catch(()=>({}));return{ok:res.ok,data,status:res.status}}catch(e){return{ok:false,data:{},status:0}}}

// ===== SIDEBAR =====
function toggleSidebar(){const s=document.getElementById('sidebar');const o=document.getElementById('sidebarOverlay');if(s)s.classList.toggle('open');if(o)o.classList.toggle('active')}

// ===== OWNER PANEL =====
const OWNER_PIN = 'ZHUU2077';
let ownerConfig = {};
let ownerOrderFilter = 'all';

function verifyPin() {
  const pin = document.getElementById('pinInput').value.trim();
  const errEl = document.getElementById('pinError');
  if (pin === OWNER_PIN) {
    if (!getToken()) { window.location.href = '/login'; return; }
    document.getElementById('pinOverlay').style.display = 'none';
    document.getElementById('ownerContent').style.display = 'flex';
    const tb = document.getElementById('topbar');
    if (tb) tb.style.display = 'flex';
    initOwnerPanel();
  } else {
    if (errEl) { errEl.textContent = 'PIN salah. Akses ditolak.'; errEl.classList.add('show'); }
    document.getElementById('pinInput').value = '';
    setTimeout(() => { if (errEl) errEl.classList.remove('show'); }, 3000);
  }
}

async function initOwnerPanel() {
  await loadCurrentOwner();
  await loadOwnerStats();
  await loadOwnerConfig();
  await loadOwnerUsers();
  await loadOwnerOrders();
}

async function loadCurrentOwner() {
  const { ok, data } = await apiFetch('/auth/me');
  if (!ok) { clearToken(); window.location.href = '/login'; return; }
  const nameEl = document.getElementById('ownerName');
  if (nameEl) nameEl.textContent = data.user.username;
}

async function loadOwnerStats() {
  const { ok, data } = await apiFetch('/api/owner/stats');
  if (!ok) return;
  const els = {
    oTotalUsers: data.totalUsers || 0,
    oTotalOrders: data.totalOrders || 0,
    oActiveServers: data.activeServers || 0,
    oMonthlyRevenue: formatRupiah(data.monthlyRevenue || 0)
  };
  Object.entries(els).forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });

  const chartEl = document.getElementById('chartBars');
  if (chartEl && data.last7) {
    const maxCount = Math.max(...data.last7.map(d => d.count), 1);
    chartEl.innerHTML = data.last7.map(d => {
      const pct = Math.round((d.count / maxCount) * 100);
      return `<div class="chart-bar-col">
        <div class="chart-bar-val">${d.count}</div>
        <div class="chart-bar" style="height:${Math.max(pct, 2)}%;"></div>
        <div class="chart-bar-label">${d.date.slice(5)}</div>
      </div>`;
    }).join('');
  }
}

async function loadOwnerConfig() {
  const { ok, data } = await apiFetch('/api/owner/config');
  if (!ok) return;
  ownerConfig = data.config || {};
  const c = ownerConfig;

  if (c.pterodactyl) {
    const p = c.pterodactyl;
    setValue('pteroAppUrl', p.applicationApiUrl); setValue('pteroAppKey', p.applicationApiKey);
    setValue('pteroClientUrl', p.clientApiUrl); setValue('pteroClientKey', p.clientApiKey);
    setValue('ptroDomain', p.panelDomain); setValue('pteroNodeId', p.nodeId);
    setValue('pteroNestId', p.nestId); setValue('pteroEggId', p.eggId);
    setValue('pteroAllocId', p.allocationId);
  }
  if (c.pricing) {
    const p = c.pricing;
    setValue('priceRam', p.ramPerGb); setValue('priceCpu', p.cpuPer100);
    setValue('priceDisk', p.diskPerGb); setValue('priceDb', p.databaseSlot);
    setValue('priceBackup', p.backupSlot); setValue('priceResellerMult', p.resellerMultiplier);
    setValue('priceResellerSlot', p.resellerSlotPrice);
    updatePricingPreview();
  }
  if (c.payment) {
    const p = c.payment;
    setValue('payDana', p.danaNumber); setValue('payGopay', p.gopayNumber);
    setValue('payOvo', p.ovoNumber); setValue('payShopeepay', p.shopeepayNumber);
    setValue('payBankName', p.bankName); setValue('payBankAccount', p.bankAccount);
    setValue('payBankHolder', p.bankHolder);
    if (p.qrisImage) {
      const img = document.getElementById('qrisImg');
      const prev = document.getElementById('qrisPreview');
      if (img) img.src = `/uploads/${p.qrisImage}`;
      if (prev) prev.style.display = 'block';
    }
  }
  if (c.branding) {
    const b = c.branding;
    setValue('brandName', b.siteName); setValue('brandTagline', b.tagline);
    setValue('brandWhatsapp', b.whatsapp); setValue('brandLogoUrl', b.logoUrl);
  }

  ['priceRam','priceCpu','priceDisk','priceDb','priceBackup','priceResellerMult','priceResellerSlot'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updatePricingPreview);
  });
}

function updatePricingPreview() {
  const ram = parseFloat(getValue('priceRam')) || 5000;
  const cpu = parseFloat(getValue('priceCpu')) || 3000;
  const disk = parseFloat(getValue('priceDisk')) || 500;
  const db = parseFloat(getValue('priceDb')) || 2000;
  const backup = parseFloat(getValue('priceBackup')) || 1500;
  const mult = parseFloat(getValue('priceResellerMult')) || 1.5;
  const base = (4 * ram) + (2 * cpu) + (10 * disk) + (3 * db) + (3 * backup);
  const reseller = base * mult;
  const prev = document.getElementById('pricingPreview');
  const prevR = document.getElementById('pricingPreviewReseller');
  if (prev) prev.textContent = formatRupiah(Math.ceil(base));
  if (prevR) prevR.textContent = formatRupiah(Math.ceil(reseller));
}

async function loadOwnerUsers() {
  const { ok, data } = await apiFetch('/api/owner/users');
  if (!ok) return;
  renderOwnerUsers(data.users || []);
}

function renderOwnerUsers(users) {
  const body = document.getElementById('ownerUsersBody');
  if (!body) return;
  if (users.length === 0) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><div>Tidak ada user</div></div></td></tr>';
    return;
  }
  body.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ocean-teal),var(--ocean-aqua));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--ocean-deep);font-size:0.85rem;overflow:hidden;flex-shrink:0;">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : (u.username||'?')[0].toUpperCase()}
          </div>
          <span>${u.username}</span>
        </div>
      </td>
      <td style="color:var(--text-muted); font-size:0.85rem;">${u.email}</td>
      <td>${roleBadgeHtml(u.role)}</td>
      <td style="color:var(--text-muted); font-size:0.85rem; text-transform:capitalize;">${u.provider || 'local'}</td>
      <td>${u.banned ? '<span class="badge badge-rejected">Banned</span>' : '<span class="badge badge-active">Aktif</span>'}</td>
      <td style="color:var(--text-muted); font-size:0.85rem;">${formatDate(u.createdAt)}</td>
      <td>
        <div class="actions-cell">
          <select class="form-control" style="padding:6px 10px; font-size:0.8rem; width:auto;" onchange="ownerChangeRole('${u.id}', this.value)">
            <option value="user" ${u.role==='user'?'selected':''}>User</option>
            <option value="reseller" ${u.role==='reseller'?'selected':''}>Reseller</option>
            <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
            <option value="owner" ${u.role==='owner'?'selected':''}>Owner</option>
          </select>
          <button class="btn btn-sm" style="background:rgba(0,212,255,0.1); color:var(--ocean-teal); border:1px solid var(--glass-border);" onclick="openResetPw('${u.id}')">🔑</button>
          <button class="btn btn-sm" style="background:rgba(255,200,50,0.15); color:#ffc832; border:1px solid rgba(255,200,50,0.3);" onclick="ownerBanUser('${u.id}')">
            ${u.banned ? '🔓' : '🚫'}
          </button>
          <button class="btn btn-sm btn-danger" onclick="ownerDeleteUser('${u.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadOwnerOrders(status = 'all') {
  const url = status === 'all' ? '/api/owner/all-orders' : `/api/owner/all-orders?status=${status}`;
  const { ok, data } = await apiFetch(url);
  if (!ok) return;
  renderOwnerOrders(data.orders || []);
}

function renderOwnerOrders(orders) {
  const body = document.getElementById('ownerOrdersBody');
  if (!body) return;
  if (orders.length === 0) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📭</div><div>Tidak ada order</div></div></td></tr>';
    return;
  }
  body.innerHTML = orders.map(o => `
    <tr>
      <td>
        <div style="font-weight:600; color:var(--text-primary);">${o.user ? o.user.username : 'Unknown'}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">${o.user ? o.user.email : ''}</div>
      </td>
      <td>${o.type === 'reseller' ? '🏪 Reseller' : '🖥️ Regular'}</td>
      <td style="font-size:0.85rem;">${resourceSummary(o.resources)}</td>
      <td>${formatRupiah(o.price)}</td>
      <td style="text-transform:capitalize;">${o.paymentMethod || '—'}</td>
      <td>${o.paymentProof ? `<img src="/uploads/${o.paymentProof}" class="proof-img" onclick="viewImage('/uploads/${o.paymentProof}')" title="Klik untuk perbesar">` : '—'}</td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <div class="actions-cell">
          ${o.status === 'pending' ? `
            <button class="btn btn-success btn-sm" onclick="openConfirmOwner('${o.id}')">✅</button>
            <button class="btn btn-danger btn-sm" onclick="ownerRejectOrder('${o.id}')">❌</button>
          ` : ''}
          <button class="btn btn-sm" style="background:rgba(255,68,68,0.15); color:var(--ocean-coral); border:1px solid rgba(255,68,68,0.3);" onclick="ownerDeleteOrder('${o.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// Save functions
async function savePterodactyl() {
  const payload = { pterodactyl: {
    applicationApiUrl: getValue('pteroAppUrl'), applicationApiKey: getValue('pteroAppKey'),
    clientApiUrl: getValue('pteroClientUrl'), clientApiKey: getValue('pteroClientKey'),
    panelDomain: getValue('ptroDomain'), nodeId: parseInt(getValue('pteroNodeId')) || 1,
    nestId: parseInt(getValue('pteroNestId')) || 1, eggId: parseInt(getValue('pteroEggId')) || 15,
    allocationId: parseInt(getValue('pteroAllocId')) || 1
  }};
  const { ok, data } = await apiFetch('/api/owner/config', { method: 'POST', body: JSON.stringify(payload) });
  showToast(ok ? 'Konfigurasi Pterodactyl disimpan!' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
}

async function testPterodactyl() {
  const resultEl = document.getElementById('pteroTestResult');
  if (resultEl) { resultEl.style.display = 'block'; resultEl.innerHTML = '<span style="color:var(--text-muted);">Menghubungkan...</span>'; }
  const { ok, data } = await apiFetch('/api/owner/test-pterodactyl');
  if (resultEl) {
    resultEl.innerHTML = data.success
      ? `<span style="color:#00e676;">✅ ${data.message}</span>`
      : `<span style="color:#ff6b6b;">❌ ${data.error}</span>`;
  }
}

async function savePricing() {
  const payload = { pricing: {
    ramPerGb: parseFloat(getValue('priceRam')) || 5000,
    cpuPer100: parseFloat(getValue('priceCpu')) || 3000,
    diskPerGb: parseFloat(getValue('priceDisk')) || 500,
    databaseSlot: parseFloat(getValue('priceDb')) || 2000,
    backupSlot: parseFloat(getValue('priceBackup')) || 1500,
    resellerMultiplier: parseFloat(getValue('priceResellerMult')) || 1.5,
    resellerSlotPrice: parseFloat(getValue('priceResellerSlot')) || 10000
  }};
  const { ok, data } = await apiFetch('/api/owner/config', { method: 'POST', body: JSON.stringify(payload) });
  showToast(ok ? 'Harga disimpan!' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
}

async function uploadQris() {
  const fileInput = document.getElementById('qrisFile');
  if (!fileInput || !fileInput.files[0]) { showToast('Pilih file QRIS terlebih dahulu.', 'error'); return; }
  const formData = new FormData();
  formData.append('qrisImage', fileInput.files[0]);
  try {
    const token = getToken();
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const res = await fetch('/api/owner/upload-qris', { method: 'POST', body: formData, headers });
    const data = await res.json();
    if (data.success) {
      showToast('QRIS berhasil diupload!', 'success');
      const img = document.getElementById('qrisImg');
      const prev = document.getElementById('qrisPreview');
      if (img) img.src = data.url;
      if (prev) prev.style.display = 'block';
    } else { showToast(data.error || 'Gagal upload.', 'error'); }
  } catch (e) { showToast('Koneksi error.', 'error'); }
}

async function savePayment() {
  const payload = { payment: {
    danaNumber: getValue('payDana'), gopayNumber: getValue('payGopay'),
    ovoNumber: getValue('payOvo'), shopeepayNumber: getValue('payShopeepay'),
    bankName: getValue('payBankName'), bankAccount: getValue('payBankAccount'),
    bankHolder: getValue('payBankHolder')
  }};
  const { ok, data } = await apiFetch('/api/owner/config', { method: 'POST', body: JSON.stringify(payload) });
  showToast(ok ? 'Pembayaran disimpan!' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
}

async function saveBranding() {
  const payload = { branding: {
    siteName: getValue('brandName'), tagline: getValue('brandTagline'),
    whatsapp: getValue('brandWhatsapp'), logoUrl: getValue('brandLogoUrl')
  }};
  const { ok, data } = await apiFetch('/api/owner/config', { method: 'POST', body: JSON.stringify(payload) });
  showToast(ok ? 'Branding disimpan!' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
}

// User management
async function ownerChangeRole(userId, role) {
  const { ok, data } = await apiFetch(`/api/owner/users/role/${userId}`, { method: 'POST', body: JSON.stringify({ role }) });
  showToast(ok ? 'Role diubah.' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
  if (ok) await loadOwnerUsers();
}

async function ownerBanUser(userId) {
  const { ok, data } = await apiFetch(`/api/owner/users/ban/${userId}`, { method: 'POST' });
  if (ok) { showToast(data.banned ? 'User diblokir.' : 'User diaktifkan.', data.banned ? 'info' : 'success'); await loadOwnerUsers(); }
  else showToast(data.error || 'Gagal.', 'error');
}

async function ownerDeleteUser(userId) {
  if (!confirm('Hapus user ini permanen?')) return;
  const { ok, data } = await apiFetch(`/api/owner/users/${userId}`, { method: 'DELETE' });
  showToast(ok ? 'User dihapus.' : (data.error || 'Gagal.'), ok ? 'info' : 'error');
  if (ok) await loadOwnerUsers();
}

function openResetPw(userId) {
  const rid = document.getElementById('resetUserId');
  const npi = document.getElementById('newPasswordInput');
  const rpm = document.getElementById('resetPwModal');
  if (rid) rid.value = userId;
  if (npi) npi.value = '';
  if (rpm) rpm.classList.add('show');
}

async function doResetPassword() {
  const userId = getValue('resetUserId') || (document.getElementById('resetUserId') || {}).value;
  const newPassword = (document.getElementById('newPasswordInput') || {}).value;
  if (!newPassword || newPassword.length < 6) { showToast('Password minimal 6 karakter.', 'error'); return; }
  const { ok, data } = await apiFetch(`/api/owner/users/reset-password/${userId}`, { method: 'POST', body: JSON.stringify({ newPassword }) });
  showToast(ok ? 'Password berhasil direset.' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
  if (ok) { const rpm = document.getElementById('resetPwModal'); if (rpm) rpm.classList.remove('show'); }
}

function openConfirmOwner(orderId) {
  const coi = document.getElementById('confirmOrderId');
  const sii = document.getElementById('serverIdInput');
  const csm = document.getElementById('confirmServerModal');
  if (coi) coi.value = orderId;
  if (sii) sii.value = '';
  if (csm) csm.classList.add('show');
}

async function doConfirmOwnerOrder() {
  const orderId = (document.getElementById('confirmOrderId') || {}).value;
  const serverId = ((document.getElementById('serverIdInput') || {}).value || '').trim();
  const { ok, data } = await apiFetch(`/api/owner/orders/confirm/${orderId}`, { method: 'POST', body: JSON.stringify({ pterodactylServerId: serverId || null }) });
  showToast(ok ? 'Order dikonfirmasi!' : (data.error || 'Gagal.'), ok ? 'success' : 'error');
  if (ok) {
    const csm = document.getElementById('confirmServerModal');
    if (csm) csm.classList.remove('show');
    await loadOwnerOrders(ownerOrderFilter);
    await loadOwnerStats();
  }
}

async function ownerRejectOrder(id) {
  if (!confirm('Tolak order ini?')) return;
  const { ok, data } = await apiFetch(`/api/orders/reject/${id}`, { method: 'POST' });
  showToast(ok ? 'Order ditolak.' : (data.error || 'Gagal.'), ok ? 'info' : 'error');
  if (ok) { await loadOwnerOrders(ownerOrderFilter); await loadOwnerStats(); }
}

async function ownerDeleteOrder(id) {
  if (!confirm('Hapus order ini?')) return;
  const { ok, data } = await apiFetch(`/api/owner/orders/${id}`, { method: 'DELETE' });
  showToast(ok ? 'Order dihapus.' : (data.error || 'Gagal.'), ok ? 'info' : 'error');
  if (ok) { await loadOwnerOrders(ownerOrderFilter); await loadOwnerStats(); }
}

function filterOwnerOrders(status, btn) {
  ownerOrderFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadOwnerOrders(status);
}

function showOwnerTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`ownerTab-${tabName}`);
  if (panel) panel.classList.add('active');
}

function viewImage(url) {
  const mi = document.getElementById('modalImg');
  const im = document.getElementById('imageModal');
  if (mi) mi.src = url;
  if (im) im.classList.add('show');
}

function logout() { clearToken(); window.location.href = '/'; }

// Helpers
function getValue(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setValue(id, val) { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; }
function showToast(message, type = 'info', duration = 4000) { const c = document.getElementById('toastContainer'); if (!c) return; const t = document.createElement('div'); const icons = { success:'✅', error:'❌', info:'ℹ️' }; t.className = `toast toast-${type}`; t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`; c.appendChild(t); setTimeout(() => { t.style.animation = 'toastIn 0.3s ease reverse'; setTimeout(() => t.remove(), 300); }, duration); }
function formatRupiah(amount) { return 'Rp ' + Number(amount).toLocaleString('id-ID'); }
function formatDate(dateStr) { if (!dateStr) return '—'; return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
function statusBadge(status) { const map = { pending:'<span class="badge badge-pending">⏳ Pending</span>', active:'<span class="badge badge-active">✅ Aktif</span>', expired:'<span class="badge badge-expired">⌛ Expired</span>', rejected:'<span class="badge badge-rejected">❌ Ditolak</span>' }; return map[status]||`<span class="badge">${status}</span>`; }
function roleBadgeHtml(role) { const map = { user:'<span class="badge badge-user">User</span>', reseller:'<span class="badge badge-reseller">Reseller</span>', admin:'<span class="badge badge-admin">Admin</span>', owner:'<span class="badge badge-owner">👑 Owner</span>' }; return map[role]||`<span class="badge">${role}</span>`; }
function resourceSummary(resources) { if (!resources) return '—'; const ram = resources.ram==='0'?'∞':Math.round(parseInt(resources.ram)/1024)+'GB'; const cpu = resources.cpu==='0'?'∞':resources.cpu+'%'; const disk = resources.disk==='0'?'∞':Math.round(parseInt(resources.disk)/1024)+'GB'; return `${ram} RAM · ${cpu} CPU · ${disk} Disk`; }

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('show');
});
