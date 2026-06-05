// ===== MAIN.JS — Shared utilities =====

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function formatRupiah(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = {
    pending:  '<span class="badge badge-pending">⏳ Pending</span>',
    active:   '<span class="badge badge-active">✅ Aktif</span>',
    expired:  '<span class="badge badge-expired">⌛ Expired</span>',
    rejected: '<span class="badge badge-rejected">❌ Ditolak</span>'
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function roleBadgeHtml(role) {
  const map = {
    user:     '<span class="badge badge-user">User</span>',
    reseller: '<span class="badge badge-reseller">Reseller</span>',
    admin:    '<span class="badge badge-admin">Admin</span>',
    owner:    '<span class="badge badge-owner">👑 Owner</span>'
  };
  return map[role] || `<span class="badge">${role}</span>`;
}

function resourceSummary(resources) {
  if (!resources) return '—';
  const ram = resources.ram === '0' ? '∞' : Math.round(parseInt(resources.ram) / 1024) + 'GB';
  const cpu = resources.cpu === '0' ? '∞' : resources.cpu + '%';
  const disk = resources.disk === '0' ? '∞' : Math.round(parseInt(resources.disk) / 1024) + 'GB';
  return `${ram} RAM · ${cpu} CPU · ${disk} Disk`;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  overlay && overlay.classList.toggle('show');
}

async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: 'Koneksi error' } };
  }
}
