const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const BUILD_DIR = path.join(__dirname, 'build');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// CRA replaces the build folder during a rebuild. A refresh in that interval
// must return a retryable response rather than crash this local preview server.
function sendFile(res, filePath, contentType) {
  const stream = fs.createReadStream(filePath);
  stream.once('error', () => {
    if (res.destroyed) return;
    if (res.headersSent) { res.destroy(); return; }
    res.writeHead(503, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '2',
    });
    res.end('DOCTIS local is updating. Please reload shortly.');
  });
  stream.once('open', () => {
    if (res.destroyed) { stream.destroy(); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    stream.pipe(res);
  });
  res.once('close', () => stream.destroy());
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(BUILD_DIR, urlPath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      sendFile(res, filePath, MIME_TYPES[ext] || 'application/octet-stream');
    } else {
      // SPA Fallback to index.html
      const indexPath = path.join(BUILD_DIR, 'index.html');
      sendFile(res, indexPath, 'text/html; charset=utf-8');
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`DOCTIS SPA server running at http://${HOST}:${PORT}`);
});
