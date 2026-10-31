const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');

const BODY_LIMIT = 8192;

// Carry a safe HTTP status and message to the common error handler.
class HttpError extends Error {
  // Construct an error that can be shown to a client.
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Send a consistent JSON response, including errors.
function sendJson(res, status, value, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(value));
}

// Compare credentials without logging or returning their values.
function matches(actual, expected) {
  if (typeof actual !== 'string' || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Refuse to start if a required credential is missing or left as an example.
function requireSecret(name) {
  const value = process.env[name];
  if (!value || value.startsWith('replace-with-')) {
    throw new Error(`Set ${name} to a private value before starting.`);
  }
  return value;
}

// Read at most 8 KiB while draining rejected bodies without retaining them.
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        if (!rejected) reject(new HttpError(413, 'Request body exceeds 8192 bytes.'));
        rejected = true;
        chunks.length = 0;
      } else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => { if (!rejected) resolve(Buffer.concat(chunks)); });
    req.on('error', () => reject(new HttpError(400, 'Request body interrupted.')));
    req.on('aborted', () => reject(new HttpError(400, 'Request body interrupted.')));
  });
}

// Require a JSON media type and parse a request body as an object.
async function readJson(req) {
  if ((req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new HttpError(415, 'Use Content-Type: application/json.');
  }
  const body = await readBody(req);
  let value;
  try { value = JSON.parse(body.toString('utf8')); }
  catch { throw new HttpError(400, 'Malformed JSON body.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Body must be a JSON object.');
  }
  return value;
}

// Match only an exact resource path and an optional positive safe integer ID.
function resourceRoute(pathname, resource) {
  if (pathname === `/${resource}`) return { id: null };
  if (!pathname.startsWith(`/${resource}/`)) return null;
  const part = pathname.slice(resource.length + 2);
  if (part.includes('/')) return null;
  if (!/^[1-9][0-9]*$/.test(part) || !Number.isSafeInteger(Number(part))) {
    throw new HttpError(400, 'ID must be a positive safe integer.');
  }
  return { id: Number(part) };
}

// Reject methods unsupported on collection or individual routes.
function checkMethod(req, res, id) {
  const allowed = id === null ? ['GET', 'POST'] : ['GET', 'PUT', 'DELETE'];
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    throw new HttpError(405, 'Method not allowed for this route.');
  }
}

// Create a local server whose request failures cannot become unhandled rejections.
function createServer(handler) {
  const server = http.createServer((req, res) => {
    Promise.resolve().then(() => handler(req, res)).catch(error => {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('Request failed:', error.code || error.name);
      if (res.headersSent) { res.destroy(); return; }
      sendJson(res, status, { error: status === 500 ? 'Internal server error.' : error.message });
    });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  server.on('error', error => {
    console.error('Server error:', error.code || error.name);
    process.exitCode = 1;
  });
  return server;
}

module.exports = { HttpError, sendJson, matches, requireSecret, readBody, readJson,
  resourceRoute, checkMethod, createServer };
