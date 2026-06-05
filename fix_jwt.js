const fs = require('fs');
let s = fs.readFileSync('server.js', 'utf8');

// Add cookie-parser after express
s = s.replace(
  `const passport = require('passport');`,
  `const passport = require('passport');\nconst cookieParser = require('cookie-parser');\nconst jwt = require('jsonwebtoken');`
);

// Add cookie-parser middleware
s = s.replace(
  `app.use(express.json());`,
  `app.use(express.json());\napp.use(cookieParser());`
);

fs.writeFileSync('server.js', s);
console.log('Done');
