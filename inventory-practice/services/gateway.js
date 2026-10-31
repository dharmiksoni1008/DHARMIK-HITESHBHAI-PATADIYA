const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { HttpError, sendJson, matches, requireSecret, readBody,
  resourceRoute, checkMethod, createServer } = require('../lib/http');

const secret = requireSecret('GATEWAY_SECRET');
const admin = requireSecret('ADMIN_KEY');
if (secret === admin) throw new Error('Use different service and admin credentials.');
const timeout = Number(process.env.GATEWAY_TIMEOUT_MS || 2000);
if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30000) {
  throw new Error('GATEWAY_TIMEOUT_MS must be between 1 and 30000.');
}
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};

// Forward only relevant headers, replacing all incoming internal credentials.
function forward(req, res, port, body) {
  return new Promise(resolve => {
    let finished = false;
    // Finish this request once and release its absolute deadline timer.
    function finish(status, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (status) sendJson(res, status, { error: value });
      resolve();
    }
    const downstream = http.request({ hostname: '127.0.0.1', port,
      path: req.url, method: req.method,
      headers: {
        'x-gateway-secret': secret,
        'content-type': req.headers['content-type'] || '',
        'content-length': body.length,
        accept: req.headers.accept || 'application/json'
      }
    }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          finish(502, 'Service response exceeds gateway limit.');
          downstream.destroy();
        } else chunks.push(chunk);
      });
      response.on('error', () => finish(502, 'Service connection failed.'));
      response.on('aborted', () => finish(502, 'Service response was interrupted.'));
      response.on('end', () => {
        if (finished) return;
        if (!res.destroyed) {
          const headers = { 'Content-Type': response.headers['content-type'] || 'application/json',
            'Cache-Control': 'no-store' };
          for (const name of ['location', 'allow']) {
            if (response.headers[name]) headers[name] = response.headers[name];
          }
          res.writeHead(response.statusCode, headers);
          res.end(Buffer.concat(chunks));
        }
        finish();
      });
    });
    const timer = setTimeout(() => {
      finish(504, 'Service request timed out.');
      downstream.destroy();
    }, timeout);
    downstream.on('error', () => finish(502, 'Service unavailable. Start the required service.'));
    downstream.end(body);
  });
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const asset = assets[pathname];
  if (asset) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      throw new HttpError(405, 'Method not allowed for this route.');
    }
    const content = await fs.readFile(path.join(__dirname, '..', 'public', asset[0]));
    res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" });
    res.end(content);
    return;
  }
  const resource = ['products', 'stock'].find(name => pathname === `/${name}` || pathname.startsWith(`/${name}/`));
  if (!resource) throw new HttpError(404, 'Route not found.');
  const route = resourceRoute(pathname, resource);
  if (!route) throw new HttpError(404, 'Route not found.');
  checkMethod(req, res, route.id);
  if (req.method !== 'GET' && !matches(req.headers.authorization, `Bearer ${admin}`)) {
    throw new HttpError(401, 'A valid admin Bearer credential is required for edits.');
  }
  await forward(req, res, resource === 'products' ? 3001 : 3002, await readBody(req));
});
server.listen(3000, '127.0.0.1', () => console.log('Gateway listening on 3000'));
