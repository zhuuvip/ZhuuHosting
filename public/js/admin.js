// ===== ADMIN.JS =====
let allAdminOrders = [];
let allAdminUsers = [];
let currentOrderFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentUser();
  await loadStats();
  await loadAdminOrders();
  await loadAdminUsers();
});

async function loadCurrentUser() {
  const { ok, data } = await apiFetch('/api/auth/me');
  if (!ok) { window.location.href = '/login'; return; }
  const u = data.user;
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
  document.getElementById('totalUsers').textContent = data.totalUsers || 0;
  document.getElementById('pendingOrders').textContent = data.pendingOrders || 0;
  document.getElementById('activeServers').textContent = data.activeServers || 0;
  document.getElementById('monthlyRevenue').textContent = formatRupiah(data.monthlyRevenue || 0);
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
      <td>
        ${o.paymentProof
          ? `<img src="/uploads/${o.paymentProof}" class="proof-img" onclick="viewImage('/uploads/${o.paymentProof}')" title="Klik untuk perbesar">`
          : '—'}
      </td>
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
          <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,var(--ocean-teal),var(--ocean-aqua)); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--ocean-deep); font-size:0.85rem; overflow:hidden; flex-shrink:0;">
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
          <select class="form-control" style="padding:6px 10px; font-size:0.8rem; width:auto;" onchange="changeRole('${u.id}', this.value)" ${u.email === getOwnerEmail() ? 'disabled' : ''}>
            <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
            <option value="reseller" ${u.role === 'reseller' ? 'selected' : ''}>Reseller</option>
            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn btn-sm" style="background:rgba(255,200,50,0.15); color:#ffc832; border:1px solid rgba(255,200,50,0.3);" onclick="toggleBan('${u.id}')" ${u.email === getOwnerEmail() ? 'disabled' : ''}>
            ${u.banned ? '🔓' : '🚫'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function getOwnerEmail() {
  return window._ownerEmail || '';
}

async function confirmOrder(id) {
  if (!confirm('Konfirmasi order ini? Server akan dibuat otomatis via Pterodactyl API.')) return;
  const { ok, data } = await apiFetch(`/api/orders/confirm/${id}`, { method: 'POST' });
  if (ok && data.success) {
    showToast('Order dikonfirmasi! ' + (data.serverId ? 'Server ID: ' + data.serverId : 'Manual setup diperlukan.'), 'success');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else {
    showToast(data.error || 'Gagal mengkonfirmasi.', 'error');
  }
}

async function rejectOrder(id) {
  if (!confirm('Tolak order ini?')) return;
  const { ok, data } = await apiFetch(`/api/orders/reject/${id}`, { method: 'POST' });
  if (ok && data.success) {
    showToast('Order ditolak.', 'info');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else {
    showToast(data.error || 'Gagal menolak.', 'error');
  }
}

async function deleteOrder(id) {
  if (!confirm('Hapus order ini? Tindakan ini tidak dapat dibatalkan.')) return;
  const { ok, data } = await apiFetch(`/api/orders/${id}`, { method: 'DELETE' });
  if (ok && data.success) {
    showToast('Order dihapus.', 'info');
    await loadAdminOrders(currentOrderFilter);
    await loadStats();
  } else {
    showToast(data.error || 'Gagal menghapus.', 'error');
  }
}

async function changeRole(userId, role) {
  const { ok, data } = await apiFetch(`/api/admin/users/role/${userId}`, {
    method: 'POST',
    body: JSON.stringify({ role })
  });
  if (ok && data.success) {
    showToast('Role berhasil diubah.', 'success');
    await loadAdminUsers();
  } else {
    showToast(data.error || 'Gagal mengubah role.', 'error');
    await loadAdminUsers();
  }
}

async function toggleBan(userId) {
  const { ok, data } = await apiFetch(`/api/admin/users/ban/${userId}`, { method: 'POST' });
  if (ok && data.success) {
    showToast(data.banned ? 'User diblokir.' : 'User diaktifkan.', data.banned ? 'error' : 'success');
    await loadAdminUsers();
  } else {
    showToast(data.error || 'Gagal.', 'error');
  }
}

function viewImage(url) {
  document.getElementById('modalImg').src = url;
  document.getElementById('imageModal').classList.add('show');
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

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}
