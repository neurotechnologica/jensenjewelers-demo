// Local SMTP "mail catcher" for tests and manual dev. Accepts everything (optionally requires AUTH), keeps messages in memory.
// CLI: node server/lead-api/dev/mail-catcher.mjs [smtpPort=2525] [httpPort=2580]  -> GET http://127.0.0.1:2580/messages
import net from 'node:net';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function startMailCatcher({ port = 0, host = '127.0.0.1', failFirst = 0, requireAuth = null } = {}) {
  const messages = [];
  let failures = failFirst;
  const server = net.createServer((s) => {
    s.setEncoding('utf8');
    let buf = '', inData = false, cur = { from: '', to: [], raw: '' }, authed = false;
    const w = (l) => s.write(`${l}\r\n`);
    w('220 mailcatcher ESMTP');
    s.on('data', (d) => {
      buf += d;
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end === -1) return;
          cur.raw = buf.slice(0, end); buf = buf.slice(end + 5); inData = false;
          if (failures > 0) { failures--; w('451 temporary failure'); cur = { from: '', to: [], raw: '' }; continue; }
          messages.push({ ...cur, raw: cur.raw.replace(/\r\n\.\./g, '\r\n.') }); cur = { from: '', to: [], raw: '' }; w('250 queued');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i === -1) return;
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        const up = line.toUpperCase();
        if (up.startsWith('EHLO')) { s.write('250-mailcatcher\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n'); }
        else if (up.startsWith('AUTH PLAIN')) {
          const [, u, p] = Buffer.from(line.split(' ')[2] || '', 'base64').toString().split('\0');
          if (requireAuth && (u !== requireAuth.user || p !== requireAuth.pass)) w('535 bad credentials'); else { authed = true; w('235 ok'); }
        }
        else if (up.startsWith('MAIL FROM:')) { if (requireAuth && !authed) w('530 auth required'); else { cur.from = line.slice(10).replace(/[<>]/g, '').trim(); w('250 ok'); } }
        else if (up.startsWith('RCPT TO:')) { cur.to.push(line.slice(8).replace(/[<>]/g, '').trim()); w('250 ok'); }
        else if (up === 'DATA') { inData = true; w('354 go'); }
        else if (up === 'QUIT') { w('221 bye'); s.end(); }
        else w('250 ok');
      }
    });
    s.on('error', () => {});
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port, messages, close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections?.(); }),
    decode: (m) => { // headers + base64 body -> {subject,text}
      const [h, ...b] = m.raw.split('\r\n\r\n');
      const subj = /^Subject: (.*)$/m.exec(h)?.[1] || '';
      return { headers: h, subject: /^=\?UTF-8\?B\?(.*)\?=$/.exec(subj) ? Buffer.from(RegExp.$1, 'base64').toString() : subj, text: Buffer.from(b.join('\r\n\r\n').replace(/\r\n/g, ''), 'base64').toString('utf8') };
    },
  })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const smtpPort = Number(process.argv[2] || 2525), httpPort = Number(process.argv[3] || 2580);
  const mc = await startMailCatcher({ port: smtpPort });
  http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(mc.messages.map((m) => ({ from: m.from, to: m.to, ...mc.decode(m) })), null, 2)); }).listen(httpPort, '127.0.0.1');
  console.log(`mail catcher: smtp 127.0.0.1:${mc.port}, messages http://127.0.0.1:${httpPort}/messages`);
}
