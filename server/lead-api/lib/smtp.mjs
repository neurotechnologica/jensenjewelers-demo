// Minimal zero-dependency SMTP client (EHLO, optional STARTTLS or implicit TLS, AUTH PLAIN/LOGIN, one message).
// Enough for a notification mailbox (Gmail/Workspace app password, Brevo, Mailgun, Postmark SMTP...). Not a general mailer.
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const noCrlf = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`);
const addr = (s) => { const m = /<([^<>]+)>/.exec(s); return noCrlf(m ? m[1] : s); };

export function buildMessage({ from, to, subject, text, replyTo, messageIdDomain }) {
  const domain = messageIdDomain || (addr(from).split('@')[1] || 'localhost');
  const body = Buffer.from(String(text).replace(/\r?\n/g, '\r\n'), 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const headers = [
    `From: ${noCrlf(from)}`,
    `To: ${to.map(noCrlf).join(', ')}`,
    `Subject: ${encWord(noCrlf(subject))}`,
    ...(replyTo ? [`Reply-To: ${noCrlf(replyTo)}`] : []),
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${body}\r\n`;
}

class Conn {
  constructor(socket, timeoutMs) { this.attach(socket); this.timeoutMs = timeoutMs; }
  attach(socket) {
    this.socket = socket; this.buf = ''; this.waiters = []; this.err = null;
    socket.setEncoding('utf8');
    socket.on('data', (d) => { this.buf += d; this.pump(); });
    socket.on('error', (e) => { this.err = e; this.pump(); });
    socket.on('close', () => { this.err = this.err || new Error('SMTP connection closed'); this.pump(); });
  }
  pump() {
    while (this.waiters.length) {
      if (this.err) { this.waiters.shift().reject(this.err); continue; }
      const lines = this.buf.split('\r\n');
      const complete = lines.slice(0, -1);
      const last = complete.findIndex((l) => /^\d{3} /.test(l) || /^\d{3}$/.test(l));
      if (last === -1) return;
      const used = complete.slice(0, last + 1);
      this.buf = lines.slice(last + 1).join('\r\n');
      this.waiters.shift().resolve({ code: Number(used[last].slice(0, 3)), lines: used });
    }
  }
  read() {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('SMTP timeout')), this.timeoutMs);
      this.waiters.push({ resolve: (v) => { clearTimeout(t); resolve(v); }, reject: (e) => { clearTimeout(t); reject(e); } });
      this.pump();
    });
  }
  async cmd(line, expect) {
    this.socket.write(`${line}\r\n`);
    const r = await this.read();
    if (!expect.includes(r.code)) throw new Error(`SMTP ${line.split(' ')[0]} failed: ${line.startsWith('AUTH') || /^[A-Za-z0-9+/=]{12,}$/.test(line) ? r.code : r.lines[r.lines.length - 1]}`);
    return r;
  }
}

export async function sendMail(cfg, msg) {
  const { host, port, secure, user, pass, timeoutMs = 10000, rejectUnauthorized = true } = cfg;
  const to = [].concat(msg.to).filter(Boolean);
  if (!host || !cfg.from || !to.length) throw new Error('SMTP not configured');
  const open = () => new Promise((resolve, reject) => {
    const s = secure === 'tls' ? tls.connect({ host, port, rejectUnauthorized, servername: host }) : net.connect({ host, port });
    s.setTimeout(timeoutMs, () => { s.destroy(new Error('SMTP connect timeout')); });
    s.once(secure === 'tls' ? 'secureConnect' : 'connect', () => resolve(s));
    s.once('error', reject);
  });
  const c = new Conn(await open(), timeoutMs);
  try {
    let r = await c.read();
    if (r.code !== 220) throw new Error('SMTP greeting rejected');
    const ehlo = async () => c.cmd(`EHLO fourcee-lead-api`, [250]);
    let caps = await ehlo();
    if (secure === 'starttls') {
      await c.cmd('STARTTLS', [220]);
      const raw = c.socket;
      raw.removeAllListeners('data');
      const t = tls.connect({ socket: raw, host, servername: host, rejectUnauthorized });
      await new Promise((res, rej) => { t.once('secureConnect', res); t.once('error', rej); });
      c.attach(t);
      caps = await ehlo();
    }
    if (user) {
      const mech = caps.lines.join(' ').toUpperCase();
      if (mech.includes('PLAIN')) await c.cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${pass}`).toString('base64')}`, [235]);
      else if (mech.includes('LOGIN')) { await c.cmd('AUTH LOGIN', [334]); await c.cmd(Buffer.from(user).toString('base64'), [334]); await c.cmd(Buffer.from(pass).toString('base64'), [235]); }
      else throw new Error('SMTP server offers no supported AUTH mechanism');
    }
    await c.cmd(`MAIL FROM:<${addr(cfg.from)}>`, [250]);
    for (const rcpt of to) await c.cmd(`RCPT TO:<${addr(rcpt)}>`, [250, 251]);
    await c.cmd('DATA', [354]);
    const data = buildMessage({ ...msg, from: cfg.from, to }).replace(/^\./gm, '..');
    c.socket.write(`${data}\r\n.\r\n`);
    r = await c.read();
    if (r.code !== 250) throw new Error(`SMTP message rejected: ${r.lines[r.lines.length - 1]}`);
    try { await c.cmd('QUIT', [221]); } catch { /* ignore */ }
    return { accepted: to.length };
  } finally {
    c.socket.destroy();
  }
}
