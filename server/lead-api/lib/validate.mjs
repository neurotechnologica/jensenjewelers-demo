// Server-side lead validation + sanitising. Never trust the browser: the client validates for UX, this is the authority.
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export const PLAN_IDS = ['starter', 'pro', 'enterprise', 'diamond'];
export const UPSELL_IDS = ['white_glove_onboarding', 'extra_location_pack']; // keep in sync with lib/pricing.mjs (tested)

const clean = (v, max) => (typeof v === 'string' ? v.replace(CTRL, '').trim().slice(0, max) : '');
/** Single-line text: also collapses CR/LF/TAB so it can never break out into an email header. */
const line = (v, max) => clean(v, max).replace(/[\r\n\t]+/g, ' ');

export function validateLead(body) {
  const errors = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: { _: 'Invalid JSON body' } };
  const name = line(body.name, 120);
  const email = line(body.email, 254).toLowerCase();
  const store = line(body.store, 160);
  const phone = line(body.phone, 32);
  const plan = line(body.plan, 40).toLowerCase();
  const notes = clean(body.notes, 2000);
  const crm = line(body.crm, 60);
  const billing = line(body.billing_cycle, 12).toLowerCase();
  const key = line(body.idempotency_key, 64);
  const pageUrl = line(body.page_url, 300);
  const upsells = Array.isArray(body.upsells) ? [...new Set(body.upsells.filter((u) => typeof u === 'string' && UPSELL_IDS.includes(u)))] : [];

  if (name.length < 2) errors.name = 'Please enter your full name';
  if (!EMAIL.test(email) || email.includes('..')) errors.email = 'Please enter a valid email address';
  if (store.length < 2) errors.store = 'Please enter your store name';
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (!/^[+\d][\d\s().-]*$/.test(phone) || digits.length < 7 || digits.length > 15) errors.phone = 'Please enter a valid phone number';
  }
  if (!plan) errors.plan = 'Please choose a plan';
  if (billing && !['monthly', 'annual'].includes(billing)) errors.billing_cycle = 'Invalid billing cycle';
  if (key && !/^[A-Za-z0-9_-]{8,64}$/.test(key)) errors.idempotency_key = 'Invalid idempotency key';
  const total = body.total == null ? null : Number(body.total);
  if (total != null && (!Number.isFinite(total) || total < 0 || total > 10_000_000)) errors.total = 'Invalid total';
  const currency = line(body.currency, 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.currency = 'Invalid currency';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { name, email, phone, store, plan, notes, crm, billing_cycle: billing || 'monthly', total, currency: currency || null, idempotency_key: key || null, page_url: pageUrl, upsells },
  };
}

/** Honeypot: a hidden field real users never see or fill. Any non-empty value => bot. */
export const isHoneypotHit = (body) => !!(body && typeof body === 'object' && typeof body.website === 'string' && body.website.trim() !== '');
