// HTTP helpers shared by every route in the server (lead capture now; demo-call guard and checkout reuse them).
export function clientIp(req, cfg) {
  if (cfg.trustProxy) {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real.trim()) return real.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function send(res, status, obj, extra = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body), ...extra });
  res.end(body);
}

/** Returns the allowed origin string, '' for "no Origin header and that is allowed", or null when the request must be refused. */
export function checkOrigin(req, cfg) {
  const origin = req.headers.origin;
  if (!origin) return cfg.allowNoOrigin ? '' : null;
  return cfg.allowedOrigins.includes(origin) ? origin : null;
}

export function corsHeaders(origin) {
  return origin
    ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' }
    : { vary: 'Origin' };
}

export function readJson(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const ct = String(req.headers['content-type'] || '');
    if (!ct.toLowerCase().startsWith('application/json')) return reject(Object.assign(new Error('Content-Type must be application/json'), { status: 415 }));
    let size = 0, over = false; const chunks = [];
    req.on('data', (c) => {
      if (over) return; // drain and discard the rest so the 413 can be delivered
      size += c.length;
      if (size > maxBytes) { over = true; chunks.length = 0; reject(Object.assign(new Error('Body too large'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => { if (over) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')); } catch { reject(Object.assign(new Error('Invalid JSON'), { status: 400 })); } });
    req.on('error', reject);
  });
}
