const https = require('https');
const data = JSON.stringify({username:'testuser_node', email:'node@example.com', password:'Password123!'});
const options = { hostname: '10.84.160.8', port: 4443, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Origin':'https://172.22.210.43:5173' }, rejectUnauthorized: false };
const req = https.request(options, (res)=>{ console.log('status', res.statusCode); let body=''; res.on('data', (c)=>body+=c); res.on('end', ()=>{ console.log('body', body); }); });
req.on('error', (e)=>{ console.error('err', e); });
req.write(data); req.end();
