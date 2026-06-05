const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(
  `const MongoStore = require('connect-mongo').default || require('connect-mongo');`,
  ``
);
content = content.replace(
  `  store: process.env.MONGODB_URI ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, ttl: 24 * 60 * 60 }) : undefined`,
  ``
);
fs.writeFileSync('server.js', content);
console.log('Done');
