// ===================================================================
// server.js -- zero-dependency local static file server.
// Lets you run "Math Adventures" on your own computer (or a home
// network / LAN so it's playable on phones/tablets too) without
// installing anything besides Node.js.
//
// Usage:
//   node server.js            (serves this folder on http://localhost:8080)
//   node server.js 3000       (custom port)
//
// Why you need this at all: browsers block a 3D game's asset loading
// (glTF models, textures, save files) when opened directly as a
// file:// page. Serving it over http:// (even just to yourself on
// localhost) fixes that. Double-click run.bat on Windows to start
// this automatically.
// ===================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.argv[2]) || 8080;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function lanAddress() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));

  // don't allow escaping the game folder
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    // Tell the browser to never cache ANY response from this local dev
    // server -- always fetch a full, fresh copy of every file, every time.
    // An earlier version of this server used ETag + "no-cache" (ask the
    // browser to revalidate before reusing a cached copy), but that still
    // lets a BAD cached copy get reused forever once its ETag matches --
    // e.g. a 3D model file that was only partially downloaded because a
    // previous page load got interrupted (tab closed mid-load) stays
    // cached-but-broken, and every later "revalidated" reload keeps
    // reusing that broken copy, hanging forever on the loading screen.
    // "no-store" is stronger: the browser is never allowed to keep a copy
    // at all, so there is nothing stale or corrupt to fall back to. On
    // localhost the cost of always re-sending the full file is negligible.
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Math Adventures with Wonderblocks and Noodle and Pals');
  console.log('  -------------------------------------------------------');
  console.log(`  Playing on this computer:  http://localhost:${PORT}`);
  const lan = lanAddress();
  if (lan) console.log(`  Playing on phones/tablets on the same WiFi:  http://${lan}:${PORT}`);
  console.log('');
  console.log('  Press Ctrl+C to stop the server.');
  console.log('');
});
