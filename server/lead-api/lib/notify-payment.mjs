// Best-effort owner notice when a payment webhook changes a lead to paid. One attempt, never throws: the payment is already recorded on the lead.
import crypto from 'node:crypto';
import { sendMail } from './smtp.mjs';

const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ');

export async function notifyPayment(lead, cfg, { fetchImpl = fetch, smtpSend = sendMail, log = () => {} } = {}) {
  const p = lead.payment || {};
  const money = `${(p.amountMinor / 100).toFixed(2)} ${p.currency}`;
  const text = `TEST-MODE payment received (${p.provider})\n\nLead:   ${lead.id}\nStore:  ${lead.store}\nPlan:   ${lead.plan} (${lead.billing_cycle})\nAmount: ${money}\nRef:    ${p.ref}\nAt:     ${p.paidAt}`;
  try {
    if (cfg.smtp.host && cfg.notifyTo.length) await smtpSend(cfg.smtp, { to: cfg.notifyTo, subject: `Payment received (test): ${oneLine(lead.store)} ${money}`, text, replyTo: lead.email });
  } catch (e) { log(`payment notice email failed: ${oneLine(e.message)}`); }
  try {
    if (cfg.webhookUrl) {
      const body = JSON.stringify({ event: 'payment.received', mode: 'test', text, lead: { id: lead.id, store: lead.store, plan: lead.plan }, payment: { provider: p.provider, amountMinor: p.amountMinor, currency: p.currency } });
      const headers = { 'content-type': 'application/json', 'user-agent': 'fourcee-lead-api/1' };
      if (cfg.webhookSecret) headers['x-fourcee-signature'] = `sha256=${crypto.createHmac('sha256', cfg.webhookSecret).update(body).digest('hex')}`;
      const r = await fetchImpl(cfg.webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(cfg.webhookTimeoutMs) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }
  } catch (e) { log(`payment notice webhook failed: ${oneLine(e.message)}`); }
}
