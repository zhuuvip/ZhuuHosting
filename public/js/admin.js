// ===== TOKEN HELPERS =====
function getToken(){return localStorage.getItem('zhuu_token')}
function setToken(t){localStorage.setItem('zhuu_token',t)}
function clearToken(){localStorage.removeItem('zhuu_token')}
async function apiFetch(url,options={}){const token=getToken();const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers['Authorization']='Bearer '+token;try{const res=await fetch(url,{...options,headers});const data=await res.json().catch(()=>({}));return{ok:res.ok,data,status:res.status}}catch(e){return{ok:false,data:{},status:0}}}

// ===== SIDEBAR =====
function toggleSidebar(){const s=document.getElementById('sidebar');const o=document.getElementById('sidebarOverlay');if(s)s.classList.toggle('open');if(o)o.classList.toggle('active')}

// ===== ADMIN =====
let allAdminOrders = [];
let allAdminUsers = [];
let currentOrderFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  if (!getToken()) { window.location.href = '/login'; return; }
  await loadCurrentUser();
  await loadStats();
  await loadAdminOrders();
  await loadAdminUsers();
});

async function loadCurrentUser() {
  const { ok, data } = await apiFetch('/auth/me');
  if (!ok) { clearToken(); window.location.href = '/login'; return; }
  const u = data.user;
  if (u.role !== 'admin' && u.role !== 'owner') { window.location.href = '/dashboard'; return; }
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) {
    if (u.avatar) avatarEl.innerHTML = `<img src="${u.avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover;">`;
    else avatarEl.textContent = (u.username || 'A')[0].toUpperCase();
  }
  const usernameEl = document.getElementById('sidebarUsername');
  if (usernameEl) usernameEl.textContent = u.username;
  const roleEl = document.getElementById('sidebarRole');
  if (roleEl) roleEl.textContent = u.role;
  if (u.role === 'owner') {
    const ol = document.getElementById('ownerLinkAdmin');
    if (ol) ol.style.display = 'flex';
  }
}

async function loadStats() {
  const { ok, data } = await apiFetch('/api/admin/stats');
  if (!ok) return;
  const tu = document.getElementById('totalUsers');
  const po = document.getElementById('pendingOrders');
  const as = document.getElementById('activeServers');
  const mr = document.getElementById('monthlyRevenue');
  if (tu) tu.textContent = data.totalUsers || 0;
  if (po) po.textContent = data.pendingOrders || 0;
  if (as) as.textContent = data.activeServers || 0;
  if (mr) mr.textContent = formatRupiah(data.monthlyRevenue || 0);
}

async function loadAdminOrders(status = 'all') {
  const url = status === 'all' ? '/api/admin/orders' : `/api/admin/orders?status=${status}`;
  const { ok, data } = await apiFetch(url);
  if (!ok) return;
  allAdminOrders = data.orders || [];
  renderAdminOrders();
}

function renderAdminOrders() {
  const body = document.getElementById('adminOrdersBody');
  if (!body) return;
  if (allAdminOrders.length === 0) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📭</div><div>Tidak ada order</div></div></td></tr>';
    return;
  }
  body.innerHTML = [...allAdminOrders].reverse().map(o => `
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
            <button class="btn btn-success btn-sm" onclick="confirmOrder('${o.id}')">✅</button>
            <button class="btn btn-danger btn-sm" onclick="rejectOrder('${o.id}')">❌</button>
          ` : ''}
          <button class="btn btn-sm" style="background:rgba(255,68,68,0.15); color:var(--ocean-coral); border:1px solid rgba(255,68,68,0.3);" onclick="deleteOrder('${o.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadAdminUsers() {
  const { ok, data } = await apiFetch('/api/admin/users');
  if (!ok) return;
  allAdminUsers = data.users || [];
  renderAdminUsers();
}

function renderAdminUsers() {
  const body = document.getElementById('adminUsersBody');
  if (!body) return;
  if (allAdminUsers.length === 0) {
    body.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👥</div><div>Tidak ada user</div></div></td></tr>';
    return;
  }
  body.innerHTML = allAdminUsers.map(u => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--ocean-teal),var(--ocean-aqua));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--ocean-deep);font-size:0.85rem;overflow:hidden;flex-shrink:0;">
            ${u.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : (u.username || '?')[0].toUpperCase()}
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
          <select class="form-control" style="padding:6px 10px; font-size:0.8rem; width:auto;" onchange="changeRole('${u.id}', this.value)">
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="reseller" ${u.role === 'reseller' ? 'selected' : ''}>Reseller</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn btn-sm" style="background:rgba(255,200,50,0.15); color:#ffc832; border:1px solid rgba(255,200,50,0.3);" onclick="toggleBan('${u.id}')">
            ${u.banned ? '🔓' : '🚫'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function confirmOrder(id) {
  if (!confirm('Konfirmasi order ini? Server akan dibuat otomatis via Pterodactyl API.')) return;
  const { ok, data } = await apiFetch(`/api/orders/confirm/${id}`, { method: 'POST' });
  if (ok && data.success) {
    showToast('Order dikonfirmasi! ' + (data.serverId ? 'Server ID: ' + data.serverId : 'Manual setup diperlukan.'), 'success');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else { showToast(data.error || 'Gagal mengkonfirmasi.', 'error'); }
}

async function rejectOrder(id) {
  if (!confirm('Tolak order ini?')) return;
  const { ok, data } = await apiFetch(`/api/orders/reject/${id}`, { method: 'POST' });
  if (ok && data.success) {
    showToast('Order ditolak.', 'info');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else { showToast(data.error || 'Gagal menolak.', 'error'); }
}

async function deleteOrder(id) {
  if (!confirm('Hapus order ini? Tindakan ini tidak dapat dibatalkan.')) return;
  const { ok, data } = await apiFetch(`/api/orders/${id}`, { method: 'DELETE' });
  if (ok && data.success) {
    showToast('Order dihapus.', 'info');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else { showToast(data.error || 'Gagal menghapus.', 'error'); }
}

async function changeRole(userId, role) {
  const { ok, data } = await apiFetch(`/api/admin/users/role/${userId}`, { method: 'POST', body: JSON.stringify({ role }) });
  if (ok && data.success) { showToast('Role berhasil diubah.', 'success'); await loadAdminUsers(); }
  else { showToast(data.error || 'Gagal mengubah role.', 'error'); await loadAdminUsers(); }
}

async function toggleBan(userId) {
  const { ok, data } = await apiFetch(`/api/admin/users/ban/${userId}`, { method: 'POST' });
  if (ok && data.success) {
    showToast(data.banned ? 'User diblokir.' : 'User diaktifkan.', data.banned ? 'error' : 'success');
    await loadAdminUsers();
  } else { showToast(data.error || 'Gagal.', 'error'); }
}

function viewImage(url) {
  const mi = document.getElementById('modalImg');
  const im = document.getElementById('imageModal');
  if (mi) mi.src = url;
  if (im) im.classList.add('show');
}

function filterOrders(status, btn) {
  currentOrderFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadAdminOrders(status);
}

function showAdminTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`adminTab-${tabName}`);
  if (panel) panel.classList.add('active');
}

function logout() { clearToken(); window.location.href = '/'; }

// Helpers
function showToast(message, type = 'info', duration = 4000) { const c = document.getElementById('toastContainer'); if (!c) return; const t = document.createElement('div'); const icons = { success:'✅', error:'❌', info:'ℹ️' }; t.className = `toast toast-${type}`; t.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${message}</span>`; c.appendChild(t); setTimeout(() => { t.style.animation = 'toastIn 0.3s ease reverse'; setTimeout(() => t.remove(), 300); }, duration); }
function formatRupiah(amount) { return 'Rp ' + Number(amount).toLocaleString('id-ID'); }
function formatDate(dateStr) { if (!dateStr) return '—'; return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }); }
function statusBadge(status) { const map = { pending:'<span class="badge badge-pending">⏳ Pending</span>', active:'<span class="badge badge-active">✅ Aktif</span>', expired:'<span class="badge badge-expired">⌛ Expired</span>', rejected:'<span class="badge badge-rejected">❌ Ditolak</span>' }; return map[status]||`<span class="badge">${status}</span>`; }
function roleBadgeHtml(role) { const map = { user:'<span class="badge badge-user">User</span>', reseller:'<span class="badge badge-reseller">Reseller</span>', admin:'<span class="badge badge-admin">Admin</span>', owner:'<span class="badge badge-owner">👑 Owner</span>' }; return map[role]||`<span class="badge">${role}</span>`; }
function resourceSummary(resources) { if (!resources) return '—'; const ram = resources.ram==='0'?'∞':Math.round(parseInt(resources.ram)/1024)+'GB'; const cpu = resources.cpu==='0'?'∞':resources.cpu+'%'; const disk = resources.disk==='0'?'∞':Math.round(parseInt(resources.disk)/1024)+'GB'; return `${ram} RAM · ${cpu} CPU · ${disk} Disk`; }
