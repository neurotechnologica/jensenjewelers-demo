// Owner notification (SMTP and/or webhook) + optional prospect confirmation. Failures never lose the lead: the lead is stored first and
// notification state is kept on the record so the sweep can retry.
import crypto from 'node:crypto';
import { sendMail } from './smtp.mjs';

const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ');

export function leadText(l) {
  return [
    `New Fourcee lead (${l.id})`,
    '',
    `Name:   ${l.name}`,
    `Email:  ${l.email}`,
    `Phone:  ${l.phone || '-'}`,
    `Store:  ${l.store}`,
    `Plan:   ${l.plan} (${l.billing_cycle})${l.total != null ? ` - ${l.currency || ''} ${l.total}`.trimEnd() : ''}`,
    `CRM:    ${l.crm || '-'}`,
    `Notes:  ${l.notes || '-'}`,
    `Page:   ${l.page_url || '-'}`,
    `At:     ${l.createdAt}`,
  ].join('\n');
}

export const notifyEnabled = (cfg) => !!((cfg.smtp.host && cfg.notifyTo.length) || cfg.webhookUrl);

/** Runs every configured channel that has not already succeeded for this lead. Returns the new notify state. */
export async function notifyLead(lead, cfg, { fetchImpl = fetch, smtpSend = sendMail } = {}) {
  const prev = lead.notify || { email: 'pending', webhook: 'pending', confirmation: 'pending', attempts: 0 };
  const st = { ...prev, attempts: prev.attempts + 1, lastError: null };
  const errs = [];

  if (cfg.smtp.host && cfg.notifyTo.length) {
    if (st.email !== 'sent') {
      try {
        await smtpSend(cfg.smtp, { to: cfg.notifyTo, subject: `New Fourcee lead: ${oneLine(lead.store)} (${lead.plan})`, text: leadText(lead), replyTo: lead.email });
        st.email = 'sent';
      } catch (e) { st.email = 'failed'; errs.push(`email: ${oneLine(e.message)}`); }
    }
  } else st.email = 'skipped';

  if (cfg.webhookUrl) {
    if (st.webhook !== 'sent') {
      try {
        const body = JSON.stringify({ event: 'lead.created', text: leadText(lead), lead: { ...lead, notify: undefined } });
        const headers = { 'content-type': 'application/json', 'user-agent': 'fourcee-lead-api/1' };
        if (cfg.webhookSecret) headers['x-fourcee-signature'] = `sha256=${crypto.createHmac('sha256', cfg.webhookSecret).update(body).digest('hex')}`;
        const res = await fetchImpl(cfg.webhookUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(cfg.webhookTimeoutMs) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        st.webhook = 'sent';
      } catch (e) { st.webhook = 'failed'; errs.push(`webhook: ${oneLine(e.message)}`); }
    }
  } else st.webhook = 'skipped';

  if (cfg.sendConfirmation && cfg.smtp.host) {
    if (st.confirmation !== 'sent') {
      try {
        await smtpSend(cfg.smtp, {
          to: [lead.email],
          subject: 'We received your Fourcee request',
          text: `Hi ${lead.name.split(' ')[0]},\n\nThanks - we have your request for ${lead.store} (${lead.plan}). We will email you a quote and next steps shortly.\n\nThis is a receipt only; no payment has been taken.\n\n- Fourcee`,
        });
        st.confirmation = 'sent';
      } catch (e) { st.confirmation = 'failed'; errs.push(`confirmation: ${oneLine(e.message)}`); }
    }
  } else st.confirmation = 'skipped';

  st.lastError = errs.length ? errs.join('; ').slice(0, 300) : null;
  st.done = ![st.email, st.webhook, st.confirmation].includes('failed');
  return st;
}
