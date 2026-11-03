/**
 * Lead capture client: validates, POSTs the "Request invoice" lead to VITE_LEAD_ENDPOINT (default /api/lead, served by server/lead-api),
 * and keeps a localStorage fallback queue so a lead is never silently lost when the network / server is down.
 * Pure functions with injectable fetch + storage so they are unit-tested without a browser.
 */
export interface LeadFields {
  name: string;
  email: string;
  phone: string;
  store: string;
  plan: string;
  billing_cycle: 'monthly' | 'annual';
  /** add-on ids chosen at checkout (the server prices them; unknown ids are dropped) */
  upsells?: string[];
  notes: string;
  crm: string;
  total: number | null;
  currency: string | null;
  /** honeypot: must stay empty (hidden input). Bots fill it. */
  website: string;
}
export type LeadPayload = LeadFields & { idempotency_key: string; page_url: string };
export type LeadErrors = Partial<Record<'name' | 'email' | 'phone' | 'store' | 'plan', string>>;

export type SubmitResult =
  | { status: 'sent'; id: string }
  | { status: 'queued'; error: string; retryable: true }
  | { status: 'invalid'; fields: Record<string, string> };

export const QUEUE_KEY = 'fourcee.leadQueue.v1';
export const QUEUE_MAX = 50;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

const envEndpoint = (): string => {
  const e = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return (e?.VITE_LEAD_ENDPOINT || '').trim();
};
export const leadEndpoint = (override?: string): string => (override ?? envEndpoint()) || '/api/lead';

export function validateLeadFields(f: Pick<LeadFields, 'name' | 'email' | 'phone' | 'store' | 'plan'>): LeadErrors {
  const e: LeadErrors = {};
  if (f.name.trim().length < 2) e.name = 'Please enter your full name';
  const email = f.email.trim();
  if (!email) e.email = 'Please enter your email address';
  else if (!EMAIL_RE.test(email) || email.includes('..')) e.email = 'Please enter a valid email address';
  if (f.store.trim().length < 2) e.store = 'Please enter your store name';
  if (f.phone.trim()) {
    const digits = f.phone.replace(/\D/g, '');
    if (!/^[+\d][\d\s().-]*$/.test(f.phone.trim()) || digits.length < 7 || digits.length > 15) e.phone = 'Please enter a valid phone number (or leave it blank)';
  }
  if (!f.plan) e.plan = 'Please choose a plan';
  return e;
}

export const newIdempotencyKey = (): string => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
const defaultStorage = (): StorageLike | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

export function readQueue(storage: StorageLike | null = defaultStorage()): LeadPayload[] {
  if (!storage) return [];
  try {
    const v = JSON.parse(storage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
function writeQueue(q: LeadPayload[], storage: StorageLike | null) {
  if (!storage) return;
  try { storage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-QUEUE_MAX))); } catch { /* quota / private mode: nothing more we can do */ }
}
export function enqueueLead(p: LeadPayload, storage: StorageLike | null = defaultStorage()) {
  const q = readQueue(storage).filter((x) => x.idempotency_key !== p.idempotency_key);
  q.push(p);
  writeQueue(q, storage);
}
export function dequeueLead(key: string, storage: StorageLike | null = defaultStorage()) {
  writeQueue(readQueue(storage).filter((x) => x.idempotency_key !== key), storage);
}

export interface SendOpts {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  timeoutMs?: number;
}

/** Shown when the response is not JSON {ok:true}. The report stays locked. */
export const LEAD_UNCONFIRMED = 'We could not confirm your request. Please try again.';

/** application/json, including a charset parameter. HTML and missing types do not qualify. */
export function isJsonContentType(header: string | null | undefined): boolean {
  return /^\s*application\/json\b/i.test(header || '');
}

/**
 * The report unlocks only for a JSON body with ok:true.
 * An SPA-fallback HTML document, a non-JSON type, or JSON without ok:true is not a confirmation.
 */
export async function readConfirmedLead(res: Pick<Response, 'headers' | 'json'>): Promise<{ id?: string } | null> {
  if (!isJsonContentType(res.headers.get('content-type'))) return null;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object' || (body as { ok?: unknown }).ok !== true) return null;
  const id = (body as { id?: unknown }).id;
  return { id: typeof id === 'string' && id ? id : undefined };
}

/** One POST attempt, no queue side effects. */
async function post(p: LeadPayload, o: SendOpts): Promise<SubmitResult> {
  const f = o.fetchImpl ?? fetch;
  try {
    const res = await f(leadEndpoint(o.endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
      signal: AbortSignal.timeout(o.timeoutMs ?? 12000),
    });
    if (res.ok) {
      const j = await readConfirmedLead(res);
      if (j) return { status: 'sent', id: j.id || p.idempotency_key };
      // A host that is not proxying /api/lead returns the SPA document with 200 text/html.
      // res.ok is not a confirmation. Keep the report locked and let the form retry.
      return { status: 'queued', retryable: true, error: LEAD_UNCONFIRMED };
    }
    if (res.status === 400) {
      const j = (await res.json().catch(() => ({}))) as { fields?: Record<string, string> };
      if (j.fields) return { status: 'invalid', fields: j.fields };
    }
    if (res.status === 429) return { status: 'queued', retryable: true, error: 'Too many requests right now. Please retry in a minute.' };
    return { status: 'queued', retryable: true, error: `Our server could not take the request (error ${res.status}).` };
  } catch {
    return { status: 'queued', retryable: true, error: 'We could not reach our server. Check your connection.' };
  }
}

/**
 * Send a lead. On network/server failure the lead is written to the localStorage queue (same idempotency key, so a later retry or a
 * background flush can never create a duplicate) and the caller shows an error + Retry. Only JSON {ok:true} removes it from the queue.
 */
export async function submitLead(p: LeadPayload, o: SendOpts = {}): Promise<SubmitResult> {
  const storage = o.storage === undefined ? defaultStorage() : o.storage;
  const r = await post(p, o);
  if (r.status === 'sent') dequeueLead(p.idempotency_key, storage);
  else if (r.status === 'queued') enqueueLead(p, storage);
  return r;
}

/** Re-send everything in the queue (page load / 'online' event). Returns how many were delivered. */
export async function flushQueue(o: SendOpts = {}): Promise<number> {
  const storage = o.storage === undefined ? defaultStorage() : o.storage;
  let delivered = 0;
  for (const p of readQueue(storage)) {
    const r = await post(p, o);
    if (r.status === 'sent') { dequeueLead(p.idempotency_key, storage); delivered++; }
    else if (r.status === 'invalid') { console.warn('lead rejected by server validation; dropped from queue', r.fields); dequeueLead(p.idempotency_key, storage); } // can never be valid; do not retry forever
    else break; // still offline: stop, keep the rest
  }
  return delivered;
}
