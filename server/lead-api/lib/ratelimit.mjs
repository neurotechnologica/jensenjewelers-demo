// In-memory sliding-window limiter (single process; fine for one small VPS service). Keys are IPs / phone numbers etc.
export class RateLimiter {
  /** @param {{ms:number,max:number}[]} windows */
  constructor(windows, now = () => Date.now()) { this.windows = windows; this.now = now; this.hits = new Map(); this.lastSweep = now(); }
  /** Records a hit when allowed. Returns {ok, retryAfterSec}. */
  take(key) {
    const t = this.now();
    this.sweep(t);
    const longest = Math.max(...this.windows.map((w) => w.ms));
    const arr = (this.hits.get(key) || []).filter((x) => t - x < longest);
    for (const w of this.windows) {
      const inWin = arr.filter((x) => t - x < w.ms);
      if (inWin.length >= w.max) {
        this.hits.set(key, arr);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((inWin[0] + w.ms - t) / 1000)) };
      }
    }
    arr.push(t);
    this.hits.set(key, arr);
    return { ok: true, retryAfterSec: 0 };
  }
  sweep(t) {
    if (t - this.lastSweep < 60_000) return;
    this.lastSweep = t;
    const longest = Math.max(...this.windows.map((w) => w.ms));
    for (const [k, arr] of this.hits) { const keep = arr.filter((x) => t - x < longest); keep.length ? this.hits.set(k, keep) : this.hits.delete(k); }
  }
}
export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
