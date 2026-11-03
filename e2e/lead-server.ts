// Local, fully mocked back end for the P0 e2e specs: real server/lead-api + a mail catcher (SMTP) + a webhook receiver. No real email/SMS/calls.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLeadApi, loadConfig } from '../server/lead-api/index.mjs';
import { startMailCatcher } from '../server/lead-api/dev/mail-catcher.mjs';

export const LEAD_PORT = Number(process.env.E2E_LEAD_PORT || 4198);
export const APP_ORIGIN = `http://127.0.0.1:${Number(process.env.E2E_PORT || 4199)}`;

export async function startLeadStack(extraEnv: Record<string, string> = {}) {
  // fake n8n: records what the guard forwards (the real webhook is never contacted)
  const n8n: { headers: http.IncomingHttpHeaders; body: any }[] = [];
  const n8nSrv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { n8n.push({ headers: req.headers, body: JSON.parse(b || '{}') }); res.writeHead(200); res.end('{}'); }); });
  await new Promise<void>((r) => n8nSrv.listen(0, '127.0.0.1', () => r()));
  // fake Cloudflare Turnstile verifier: only the stub token passes
  const tsSeen: string[] = [];
  const tsSrv = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { tsSeen.push(b); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ success: new URLSearchParams(b).get('response') === 'stub-token-0123456789' })); }); });
  await new Promise<void>((r) => tsSrv.listen(0, '127.0.0.1', () => r()));
  const tsPort = (tsSrv.address() as { port: number }).port;
  const n8nPort = (n8nSrv.address() as { port: number }).port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fourcee-e2e-'));
  const mail = await startMailCatcher();
  const hooks: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  const hook = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hooks.push({ headers: req.headers, body: b }); res.writeHead(200); res.end('{}'); }); });
  await new Promise<void>((r) => hook.listen(0, '127.0.0.1', () => r()));
  const hookPort = (hook.address() as { port: number }).port;
  const cfg = loadConfig({
    LEAD_PORT: String(LEAD_PORT), LEAD_DATA_DIR: dir, LEAD_ALLOWED_ORIGINS: APP_ORIGIN,
    SMTP_HOST: '127.0.0.1', SMTP_PORT: String(mail.port), SMTP_SECURE: 'none', SMTP_FROM: 'Fourcee <leads@fourcee.test>', LEAD_NOTIFY_TO: 'owner@fourcee.test',
    LEAD_WEBHOOK_URL: `http://127.0.0.1:${hookPort}/hook`, N8N_DEMO_WEBHOOK_URL: `http://127.0.0.1:${n8nPort}/webhook/voice-demo-request`, N8N_DEMO_WEBHOOK_SECRET: 'e2e-secret', TURNSTILE_VERIFY_URL: `http://127.0.0.1:${tsPort}/siteverify`, DEMO_PER_IP_PER_HOUR: '100', DEMO_PER_IP_PER_DAY: '100', DEMO_NUMBER_COOLDOWN_SEC: '1', LEAD_RATE_PER_MIN: '60', LEAD_RATE_PER_HOUR: '600', LEAD_MAX_PER_DAY_PER_IP: '600', ...extraEnv,
  });
  const api = await createLeadApi(cfg, { log: () => {} });
  await api.listen();
  return {
    api, mail, hooks, dir, cfg, n8n, tsSeen,
    leads: () => (api.store as any).items as Record<string, any>[],
    stop: async () => { await api.close(); await mail.close(); await new Promise((r) => { tsSrv.close(() => r(null)); tsSrv.closeAllConnections?.(); }); await new Promise((r) => { n8nSrv.close(() => r(null)); n8nSrv.closeAllConnections?.(); }); await new Promise((r) => { hook.close(() => r(null)); hook.closeAllConnections?.(); }); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}
export type LeadStack = Awaited<ReturnType<typeof startLeadStack>>;
