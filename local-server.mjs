import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const dataDir = path.join(root, 'data');
const bookingsFile = path.join(dataDir, 'bookings.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(bookingsFile)) {
  fs.writeFileSync(bookingsFile, JSON.stringify({ bookings: [] }, null, 2));
}

function readBookings() {
  return JSON.parse(fs.readFileSync(bookingsFile, 'utf8'));
}

function writeBookings(payload) {
  fs.writeFileSync(bookingsFile, JSON.stringify(payload, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.ics') return 'text/calendar; charset=utf-8';
  return 'application/octet-stream';
}

function serveStatic(req, res, urlPath) {
  const pathname = urlPath === '/' ? '/index.html' : urlPath;
  const resolved = path.normalize(path.join(root, pathname));
  if (!resolved.startsWith(root)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    sendText(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': mimeType(resolved),
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(resolved).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createBooking(payload) {
  const store = readBookings();
  const booking = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    ...payload,
  };
  store.bookings.unshift(booking);
  writeBookings(store);
  return booking;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/bookings' && req.method === 'GET') {
    sendJson(res, 200, readBookings());
    return;
  }

  if (url.pathname === '/api/bookings' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const booking = createBooking(body);
      sendJson(res, 201, booking);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid booking payload' });
    }
    return;
  }

  if (url.pathname === '/api/invite-preview' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      sendJson(res, 200, {
        preview: `${body.meetingType || 'Coffee Chat'} invitation to ${body.selectedSlot?.date || ''} ${body.selectedSlot?.time || ''}`,
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Invalid preview payload' });
    }
    return;
  }

  serveStatic(req, res, decodeURIComponent(url.pathname));
});

const port = process.env.PORT ? Number(process.env.PORT) : 4175;
server.listen(port, '127.0.0.1', () => {
  console.log(`Coffee Chat Linkflow server running at http://127.0.0.1:${port}`);
});
