// ===== DASHBOARD.JS =====
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();
  await loadOrders();
  await loadNotifications();
  showTab('overview');
});

async function loadUser() {
  const { ok, data } = await apiFetch('/api/auth/me');
  if (!ok) {
    window.location.href = '/login';
    return;
  }
  currentUser = data.user;
  renderUserInfo();
}

function renderUserInfo() {
  const u = currentUser;
  if (!u) return;

  // Sidebar
  const avatarEl = document.getElementById('sidebarAvatar');
  if (u.avatar) {
    avatarEl.innerHTML = `<img src="${u.avatar}" alt="avatar">`;
  } else {
    avatarEl.textContent = (u.username || '?')[0].toUpperCase();
  }
  const usernameEl = document.getElementById('sidebarUsername');
  if (usernameEl) usernameEl.textContent = u.username;
  const roleEl = document.getElementById('sidebarRole');
  if (roleEl) roleEl.textContent = u.role;

  // Welcome card
  const welcomeAvatar = document.getElementById('welcomeAvatar');
  if (u.avatar) welcomeAvatar.innerHTML = `<img src="${u.avatar}" alt="avatar">`;
  else welcomeAvatar.textContent = (u.username || '?')[0].toUpperCase();
  const welcomeName = document.getElementById('welcomeName');
  if (welcomeName) welcomeName.textContent = 'Halo, ' + u.username + '!';
  const welcomeInfo = document.getElementById('welcomeInfo');
  if (welcomeInfo) welcomeInfo.textContent = u.email + ' · Bergabung ' + formatDate(u.createdAt);
  const roleBadgeEl = document.getElementById('roleBadge');
  if (roleBadgeEl) roleBadgeEl.outerHTML = roleBadgeHtml(u.role);

  // Show admin/owner links
  if (u.role === 'admin' || u.role === 'owner') {
    const al = document.getElementById('adminLink');
    if (al) al.style.display = 'flex';
  }
  if (u.role === 'owner') {
    const ol = document.getElementById('ownerLink');
    if (ol) ol.style.display = 'flex';
  }
  if (u.role === 'reseller' || u.role === 'owner') {
    const rn = document.getElementById('resellerNav');
    if (rn) rn.style.display = 'block';
  }
}

async function loadOrders() {
  const { ok, data } = await apiFetch('/api/orders');
  if (!ok) return;
  const orders = data.orders || [];

  // Stats
  const active = orders.filter(o => o.status === 'active').length;
  const pending = orders.filter(o => o.status === 'pending').length;

  document.getElementById('statActive').textContent = active;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statTotal').textContent = orders.length;

  // Recent orders (last 5)
  const recent = [...orders].reverse().slice(0, 5);
  const recentBody = document.getElementById('recentOrdersBody');
  if (recentBody) {
    if (recent.length === 0) {
      recentBody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📭</div><div>Belum ada order</div></div></td></tr>';
    } else {
      recentBody.innerHTML = recent.map(o => `
        <tr>
          <td>${formatDate(o.createdAt)}</td>
          <td>${o.type === 'reseller' ? '🏪 Reseller' : '🖥️ Regular'}</td>
          <td>${resourceSummary(o.resources)}</td>
          <td>${formatRupiah(o.price)}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>
      `).join('');
    }
  }

  // All orders tab
  const ordersBody = document.getElementById('ordersBody');
  if (ordersBody) {
    if (orders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">📭</div><div>Belum ada order</div></div></td></tr>';
    } else {
      ordersBody.innerHTML = [...orders].reverse().map(o => `
        <tr>
          <td>${formatDate(o.createdAt)}</td>
          <td>${o.type === 'reseller' ? '🏪 Reseller' : '🖥️ Regular'}</td>
          <td>${o.resources ? Math.round(parseInt(o.resources.ram)/1024) + 'GB' : '—'}</td>
          <td>${o.resources ? o.resources.cpu + '%' : '—'}</td>
          <td>${o.resources ? Math.round(parseInt(o.resources.disk)/1024) + 'GB' : '—'}</td>
          <td>${formatRupiah(o.price)}</td>
          <td style="text-transform:capitalize;">${o.paymentMethod || '—'}</td>
          <td>${statusBadge(o.status)}</td>
        </tr>
      `).join('');
    }
  }

  // Servers tab (active only)
  const serversBody = document.getElementById('serversBody');
  const activeOrders = orders.filter(o => o.status === 'active');
  if (serversBody) {
    if (activeOrders.length === 0) {
      serversBody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🌊</div><div>Belum ada server aktif</div></div></td></tr>';
    } else {
      serversBody.innerHTML = activeOrders.map(o => `
        <tr>
          <td>${o.pterodactylServerId || '—'}</td>
          <td>${o.resources ? (o.resources.ram === '0' ? '∞' : Math.round(parseInt(o.resources.ram)/1024) + ' GB') : '—'}</td>
          <td>${o.resources ? (o.resources.cpu === '0' ? '∞' : o.resources.cpu + '%') : '—'}</td>
          <td>${o.resources ? (o.resources.disk === '0' ? '∞' : Math.round(parseInt(o.resources.disk)/1024) + ' GB') : '—'}</td>
          <td>${formatDate(o.expiredAt)}</td>
          <td>${statusBadge(o.status)}</td>
          <td>
            ${o.pterodactylServerId ? `<a href="#" class="btn btn-outline btn-sm">🔗 Panel</a>` : '<span style="color:var(--text-muted); font-size:0.8rem;">Menunggu setup</span>'}
          </td>
        </tr>
      `).join('');
    }
  }

  // Reseller stats
  if (currentUser && (currentUser.role === 'reseller' || currentUser.role === 'owner')) {
    const resellerOrder = activeOrders.find(o => o.type === 'reseller');
    const totalSlots = resellerOrder ? (parseInt(resellerOrder.resources.slots) || 0) : 0;
    document.getElementById('resellerSlotsTotal').textContent = totalSlots === 0 ? '∞' : totalSlots;
    document.getElementById('resellerSlotsUsed').textContent = '0';
  }
}

async function loadNotifications() {
  const { ok, data } = await apiFetch('/api/notifications');
  if (!ok) return;
  const notifs = data.notifications || [];
  const unread = notifs.filter(n => !n.read).length;

  document.getElementById('statUnread').textContent = unread;

  const badge = document.getElementById('unreadBadge');
  if (badge) {
    if (unread > 0) {
      badge.textContent = unread;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  const notifList = document.getElementById('notifList');
  if (notifList) {
    if (notifs.length === 0) {
      notifList.innerHTML = '<div class="glass-card" style="padding:24px;"><div class="empty-state"><div class="empty-state-icon">🔔</div><div>Tidak ada notifikasi</div></div></div>';
    } else {
      notifList.innerHTML = notifs.map(n => `
        <div class="glass-card" style="padding:16px 20px; margin-bottom:12px; cursor:pointer; opacity:${n.read ? 0.6 : 1};" onclick="markRead('${n.id}', this)">
          <div style="display:flex; align-items:flex-start; gap:12px;">
            <span style="font-size:1.2rem;">🔔</span>
            <div style="flex:1;">
              <p style="color:var(--text-primary); font-size:0.95rem;">${n.message}</p>
              <p style="color:var(--text-muted); font-size:0.8rem; margin-top:4px;">${formatDateTime(n.createdAt)}</p>
            </div>
            ${!n.read ? '<span class="badge badge-pending" style="font-size:0.65rem; padding:2px 8px; flex-shrink:0;">Baru</span>' : ''}
          </div>
        </div>
      `).join('');
    }
  }
}

async function markRead(id, el) {
  await apiFetch(`/api/notifications/read/${id}`, { method: 'POST' });
  el.style.opacity = '0.6';
  const badge = el.querySelector('.badge');
  if (badge) badge.remove();
}

function showTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}
