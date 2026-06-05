const fs = require('fs');

// Fix server.js - kirim token di response body juga
let s = fs.readFileSync('server.js', 'utf8');
s = s.replace(
  `app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.json({ loggedIn: false });
  const { password, ...safeUser } = req.user;
  res.json({ loggedIn: true, user: safeUser });
});`,
  `app.get('/api/auth/me', (req, res) => {
  // Check JWT from Authorization header OR cookie
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      const db = readDb();
      const user = db.users.find(u => u.id === decoded.id);
      if (user) {
        const { password, ...safeUser } = user;
        const ownerEmail = process.env.OWNER_EMAIL || 'zhuusite@gmail.com';
        if (user.email === ownerEmail) safeUser.role = 'owner';
        return res.json({ loggedIn: true, user: safeUser });
      }
    } catch(e) {}
  }
  if (!req.user) return res.json({ loggedIn: false });
  const { password, ...safeUser } = req.user;
  res.json({ loggedIn: true, user: safeUser });
});`
);
fs.writeFileSync('server.js', s);

// Fix routes/auth.js - return token in response body
let a = fs.readFileSync('routes/auth.js', 'utf8');
a = a.replace(
  `      setJwtCookie(res, user);\n      res.json({ success: true, redirect: '/dashboard' });`,
  `      setJwtCookie(res, user);\n      const tok = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });\n      res.json({ success: true, redirect: '/dashboard', token: tok });`
);
fs.writeFileSync('routes/auth.js', a);

console.log('Done');
