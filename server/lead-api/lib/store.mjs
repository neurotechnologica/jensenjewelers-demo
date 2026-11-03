// Lead repository. Every store implements the SAME async interface, so the receiver never knows what is underneath:
//
//   init()                              prepare the backend (create file / run migration)
//   add(lead)            -> lead        insert a new lead (lead.id is a uuid chosen by the caller)
//   get(id)              -> lead|null
//   findByIdempotencyKey(key) -> lead|null
//   update(id, patch)    -> lead|null   shallow-merge patch into the lead (unknown keys are kept)
//   countSince(isoOrMs)  -> number      leads created at/after the timestamp (daily cap)
//   count()              -> number
//   pendingNotifications(maxAttempts) -> lead[]   leads whose owner notification has not completed
//   close()
//
// createStore(cfg): DATABASE_URL set  -> PostgresStore (lib/store-pg.mjs, needs the `pg` package)
//                   otherwise         -> JsonFileStore (zero dependencies; development, tests and single-box fallback)
import fs from 'node:fs';
import path from 'node:path';

export class JsonFileStore {
  constructor(file) {
    this.file = file;
    this.items = [];
    this.chain = Promise.resolve();
  }
  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      try { this.items = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch {
        fs.renameSync(this.file, `${this.file}.corrupt-${Date.now()}`); // never overwrite a corrupt file: keep it for forensics
        this.items = [];
      }
    }
  }
  persist() {
    const data = JSON.stringify(this.items, null, 2);
    this.chain = this.chain.then(() => {
      const tmp = `${this.file}.tmp-${process.pid}`;
      fs.writeFileSync(tmp, data, { mode: 0o600 });
      fs.renameSync(tmp, this.file); // atomic replace
    });
    return this.chain;
  }
  async add(lead) { this.items.push(lead); await this.persist(); return lead; }
  async get(id) { return this.items.find((x) => x.id === id) || null; }
  async findByIdempotencyKey(key) { return key ? this.items.find((x) => x.idempotency_key === key) || null : null; }
  async update(id, patch) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return null;
    Object.assign(it, patch);
    await this.persist();
    return it;
  }
  async countSince(ts) { const t = typeof ts === 'number' ? ts : Date.parse(ts); return this.items.filter((x) => Date.parse(x.createdAt) >= t).length; }
  async count() { return this.items.length; }
  async pendingNotifications(maxAttempts) { return this.items.filter((l) => l.notify && !l.notify.done && l.notify.attempts < maxAttempts); }
  async all() { return this.items.slice(); } // convenience for tests / ops scripts; not part of the required interface
  async close() { await this.chain; }
}

export async function createStore(cfg) {
  let store;
  if (cfg.databaseUrl) {
    const { PostgresStore } = await import('./store-pg.mjs');
    store = new PostgresStore(cfg.databaseUrl, { ssl: cfg.databaseSsl });
  } else {
    store = new JsonFileStore(path.join(cfg.dataDir, 'leads.json'));
  }
  await store.init();
  return store;
}
