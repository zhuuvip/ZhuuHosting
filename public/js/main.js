// ===== TOKEN HELPERS =====
function getToken(){return localStorage.getItem('zhuu_token')}
function setToken(t){localStorage.setItem('zhuu_token',t)}
function clearToken(){localStorage.removeItem('zhuu_token')}
async function apiFetch(url,options={}){const token=getToken();const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers['Authorization']='Bearer '+token;try{const res=await fetch(url,{...options,headers});const data=await res.json().catch(()=>({}));return{ok:res.ok,data,status:res.status}}catch(e){return{ok:false,data:{},status:0}}}

// ===== SIDEBAR =====
function toggleSidebar(){const s=document.getElementById('sidebar');const o=document.getElementById('sidebarOverlay');if(s)s.classList.toggle('open');if(o)o.classList.toggle('active')}

// ===== UTILITIES =====
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

// ===== LOGIN FORM HANDLER =====
async function handleLoginForm(e) {
  if (e) e.preventDefault();
  const emailEl = document.getElementById('email');
  const passwordEl = document.getElementById('password');
  const alertEl = document.getElementById('loginAlert');
  if (!emailEl || !passwordEl) return;

  const email = emailEl.value.trim();
  const password = passwordEl.value;
  if (!email || !password) {
    if (alertEl) { alertEl.textContent = 'Email dan password harus diisi.'; alertEl.classList.add('show'); }
    return;
  }

  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Masuk...'; }

  const { ok, data } = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });

  if (ok && data.success && data.token) {
    setToken(data.token);
    window.location.href = data.redirect || '/dashboard';
  } else {
    if (alertEl) { alertEl.textContent = data.error || 'Login gagal.'; alertEl.classList.add('show'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

// ===== REGISTER FORM HANDLER =====
async function handleRegisterForm(e) {
  if (e) e.preventDefault();
  const alertEl = document.getElementById('registerAlert');
  const successEl = document.getElementById('registerSuccess');
  if (alertEl) alertEl.classList.remove('show');
  if (successEl) successEl.classList.remove('show');

  const username = (document.getElementById('username') || {}).value || '';
  const email = (document.getElementById('email') || {}).value || '';
  const password = (document.getElementById('password') || {}).value || '';
  const confirmPassword = (document.getElementById('confirmPassword') || {}).value || '';

  const btn = document.getElementById('registerBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Mendaftar...'; }

  const { ok, data } = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, email, password, confirmPassword })
  });

  if (ok && data.success) {
    if (successEl) { successEl.textContent = data.message; successEl.classList.add('show'); }
    setTimeout(() => window.location.href = '/login', 1800);
  } else {
    if (alertEl) { alertEl.textContent = data.error || 'Pendaftaran gagal.'; alertEl.classList.add('show'); }
    if (btn) { btn.disabled = false; btn.textContent = 'Daftar'; }
  }
}

// ===== LOGOUT =====
function logout() {
  clearToken();
  window.location.href = '/';
}

// ===== AUTO-ATTACH FORMS =====
document.addEventListener('DOMContentLoaded', () => {
  // Handle ?error= on login page
  const params = new URLSearchParams(window.location.search);
  const err = params.get('error');
  if (err) {
    const alertEl = document.getElementById('loginAlert');
    if (alertEl) {
      const msgs = { google: 'Login Google gagal.', github: 'Login GitHub gagal.', discord: 'Login Discord gagal.' };
      alertEl.textContent = msgs[err] || 'Login gagal.';
      alertEl.classList.add('show');
    }
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLoginForm);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegisterForm);
});
