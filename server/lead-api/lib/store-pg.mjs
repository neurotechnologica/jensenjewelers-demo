// PostgreSQL implementation of the lead repository (see store.mjs for the interface). Needs the `pg` package (optionalDependency).
// The pool is created lazily; the schema is applied idempotently by init() (sql/001_leads.sql).
import fs from 'node:fs';

// lead property -> column. Anything not listed here is stored inside the `extra` jsonb column and comes back on the lead unchanged.
const COLS = {
  id: 'id', createdAt: 'created_at', name: 'name', email: 'email', phone: 'phone', store: 'store', plan: 'plan', billing_cycle: 'billing_cycle', notes: 'notes',
  crm: 'crm', total: 'total', currency: 'currency', page_url: 'page_url', idempotency_key: 'idempotency_key', paymentStatus: 'payment_status', ipHash: 'ip_hash',
  userAgent: 'user_agent', notify: 'notify',
};
const JSONB = new Set(['notify']);
const REV = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [v, k]));

export function rowToLead(r) {
  const lead = { ...(r.extra || {}) };
  for (const [col, key] of Object.entries(REV)) {
    let v = r[col];
    if (v === undefined) continue;
    if (col === 'created_at') v = new Date(v).toISOString();
    if (col === 'total' && v !== null) v = Number(v);
    if (col === 'currency' && v !== null) v = String(v).trim();
    lead[key] = v;
  }
  return lead;
}

export class PostgresStore {
  constructor(databaseUrl, { ssl = false, poolFactory } = {}) { this.url = databaseUrl; this.ssl = ssl; this.poolFactory = poolFactory; this.pool = null; }
  async init() {
    if (this.poolFactory) this.pool = await this.poolFactory();
    else {
      let pg;
      try { pg = (await import('pg')).default; } catch { throw new Error('DATABASE_URL is set but the "pg" package is not installed. Run: npm install pg'); }
      this.pool = new pg.Pool({ connectionString: this.url, max: 5, ssl: this.ssl ? { rejectUnauthorized: false } : undefined });
    }
    await this.pool.query(fs.readFileSync(new URL('../sql/001_leads.sql', import.meta.url), 'utf8'));
  }
  q(text, params) { return this.pool.query(text, params); }
  split(obj) {
    const cols = {}, extra = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      if (COLS[k]) cols[COLS[k]] = JSONB.has(k) ? JSON.stringify(v) : v;
      else extra[k] = v;
    }
    return { cols, extra };
  }
  async add(lead) {
    const { cols, extra } = this.split(lead);
    const names = [...Object.keys(cols), 'extra'];
    const vals = [...Object.values(cols), JSON.stringify(extra)];
    const ph = names.map((n, i) => (n === 'notify' || n === 'extra' ? `$${i + 1}::jsonb` : `$${i + 1}`));
    await this.q(`INSERT INTO leads (${names.join(', ')}) VALUES (${ph.join(', ')})`, vals);
    return lead;
  }
  async get(id) { const r = await this.q('SELECT * FROM leads WHERE id = $1', [id]); return r.rows[0] ? rowToLead(r.rows[0]) : null; }
  async findByIdempotencyKey(key) {
    if (!key) return null;
    const r = await this.q('SELECT * FROM leads WHERE idempotency_key = $1', [key]);
    return r.rows[0] ? rowToLead(r.rows[0]) : null;
  }
  async update(id, patch) {
    const { cols, extra } = this.split(patch);
    const sets = [], vals = [id];
    for (const [c, v] of Object.entries(cols)) { vals.push(v); sets.push(`${c} = $${vals.length}${c === 'notify' ? '::jsonb' : ''}`); }
    if (Object.keys(extra).length) { vals.push(JSON.stringify(extra)); sets.push(`extra = extra || $${vals.length}::jsonb`); }
    if (!sets.length) return this.get(id);
    const r = await this.q(`UPDATE leads SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, vals);
    return r.rows[0] ? rowToLead(r.rows[0]) : null;
  }
  async countSince(ts) { const d = new Date(typeof ts === 'number' ? ts : Date.parse(ts)); return Number((await this.q('SELECT count(*) AS n FROM leads WHERE created_at >= $1', [d])).rows[0].n); }
  async count() { return Number((await this.q('SELECT count(*) AS n FROM leads')).rows[0].n); }
  async pendingNotifications(maxAttempts) {
    const r = await this.q(`SELECT * FROM leads WHERE (notify->>'done') IS DISTINCT FROM 'true' AND COALESCE((notify->>'attempts')::int, 0) < $1 ORDER BY created_at LIMIT 200`, [maxAttempts]);
    return r.rows.map(rowToLead);
  }
  async all() { return (await this.q('SELECT * FROM leads ORDER BY created_at')).rows.map(rowToLead); }
  async close() { if (this.pool) await this.pool.end(); }
}
