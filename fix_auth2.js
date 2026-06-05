const fs = require('fs');
let s = fs.readFileSync('routes/auth.js', 'utf8');
s = s.replace(
  `const DB_PATH = path.join('/tmp', 'db.json');`,
  `const DB_PATH = path.join('/tmp', 'db.json');\nconst jwt = require('jsonwebtoken');\nconst JWT_SECRET = process.env.SESSION_SECRET || 'zhuu_secret_2077';\nfunction setJwtCookie(res, user) {\n  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });\n  res.cookie('zhuu_token', token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: 'lax' });\n}`
);
s = s.replace(
  `      res.json({ success: true, redirect: '/dashboard' });`,
  `      setJwtCookie(res, user);\n      res.json({ success: true, redirect: '/dashboard' });`
);
s = s.replace(
  `router.get('/logout', (req, res) => { req.logout(() => { res.redirect('/'); }); });`,
  `router.get('/logout', (req, res) => { res.clearCookie('zhuu_token'); req.logout ? req.logout(() => res.redirect('/')) : res.redirect('/'); });`
);
fs.writeFileSync('routes/auth.js', s);
console.log('Done');
