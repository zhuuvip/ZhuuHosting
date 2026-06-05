const jwt = require('jsonwebtoken');

function getJwtUser(req) {
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    try {
      return jwt.verify(auth.slice(7), process.env.SESSION_SECRET || 'zhuu_secret_2077');
    } catch (e) { return null; }
  }
  return req.user || null;
}

function requireLogin(req, res, next) {
  // For API routes return JSON, for page routes redirect
  const isApi = req.path.startsWith('/api') || req.headers['content-type'] === 'application/json' || req.headers['authorization'];
  const user = getJwtUser(req);
  if (!user) {
    if (isApi) return res.status(401).json({ error: 'Unauthorized. Silakan login.' });
    return res.redirect('/login');
  }
  req.jwtUser = user;
  next();
}

function requireAdmin(req, res, next) {
  const isApi = req.path.startsWith('/api') || req.headers['authorization'];
  const user = getJwtUser(req);
  if (!user) {
    if (isApi) return res.status(401).json({ error: 'Unauthorized.' });
    return res.redirect('/login');
  }
  if (user.role !== 'admin' && user.role !== 'owner' && user.email !== process.env.OWNER_EMAIL) {
    if (isApi) return res.status(403).json({ error: 'Akses ditolak.' });
    return res.redirect('/dashboard');
  }
  req.jwtUser = user;
  next();
}

function requireOwner(req, res, next) {
  const isApi = req.path.startsWith('/api') || req.headers['authorization'];
  const user = getJwtUser(req);
  if (!user) {
    if (isApi) return res.status(401).json({ error: 'Unauthorized.' });
    return res.redirect('/login');
  }
  if (user.email !== process.env.OWNER_EMAIL) {
    if (isApi) return res.status(403).json({ error: 'Akses ditolak.' });
    return res.redirect('/dashboard');
  }
  req.jwtUser = user;
  next();
}

module.exports = { requireLogin, requireAdmin, requireOwner, getJwtUser };
