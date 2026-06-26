require('dotenv').config();
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT        = process.env.PORT || 3000;
const chatHandler = require('./api/chat');
const leadHandler = require('./api/lead');

/* ── Node http req/res → Vercel-like 어댑터 ── */
async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  req.body = raw;
}

function wrapRes(nodeRes) {
  let code = 200;
  return {
    status(c) { code = c; return this; },
    json(data) {
      nodeRes.writeHead(code, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      nodeRes.end(JSON.stringify(data));
    },
  };
}

/* ── 정적 파일 ── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
  const url  = req.url.split('?')[0];
  const rel  = url === '/' ? 'index.html' : url;
  const file = path.normalize(path.join(__dirname, rel));

  if (!file.startsWith(__dirname + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ── 서버 ── */
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'POST' && req.url === '/api/chat') {
    await readBody(req);
    return chatHandler(req, wrapRes(res));
  }

  if (req.method === 'POST' && req.url === '/api/lead') {
    await readBody(req);
    return leadHandler(req, wrapRes(res));
  }

  serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`✅  Softier → http://localhost:${PORT}`);
});
