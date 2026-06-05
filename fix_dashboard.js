const fs = require('fs');

const apiFetchFix = `
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
`;

// Fix all JS files
['public/js/dashboard.js','public/js/admin.js','public/js/owner.js','public/js/order.js'].forEach(file => {
  let s = fs.readFileSync(file, 'utf8');
  // Replace existing apiFetch if exists
  if (s.includes('async function apiFetch')) {
    s = s.replace(/\/\/ Auth helper[\s\S]*?async function apiFetch[\s\S]*?\}\s*\}/, apiFetchFix.trim());
  } else {
    s = apiFetchFix + '\n' + s;
  }
  fs.writeFileSync(file, s);
});

// Fix main.js login to save token
let m = fs.readFileSync('public/js/main.js', 'utf8');
if (!m.includes('setToken')) {
  m = `function getToken() { return localStorage.getItem('zhuu_token'); }
function setToken(t) { localStorage.setItem('zhuu_token', t); }
function clearToken() { localStorage.removeItem('zhuu_token'); }
` + m;
}
// Save token after login
m = m.replace(
  /if\s*\(data\.success\)/g,
  `if (data.token) setToken(data.token); if (data.success)`
);
fs.writeFileSync('public/js/main.js', m);

console.log('Done');
