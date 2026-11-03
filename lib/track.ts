/**
 * Tiny self-hosted event tracker for the short prospect page. No cookies, no third-party script, no phone numbers or other PII in
 * events. Posts batches to the Fourcee platform API (VITE_TRACK_URL) with sendBeacon (text/plain => no CORS preflight).
 * Honours Do-Not-Track / Global Privacy Control. Without VITE_TRACK_URL nothing leaves the browser; events are kept in
 * `window.__fourceeEvents` (bounded) so tests can assert them.
 *
 * Wire format (proposed contract for the platform's POST /v1/public/events, not built yet):
 *   { v:1, sid, lead_id, variant, page, vw, vh, mobile, ref, utm:{source,medium,campaign,content},
 *     events:[{ n:'cta_click', t:<ms since page start>, p:{...small scalar props} }] }
 */
export type Scalar = string | number | boolean | null;
export interface TrackEvent { n: string; t: number; p?: Record<string, Scalar> }

declare global { interface Window { __fourceeEvents?: TrackEvent[] } }

const MAX_LOCAL = 200;
const FLUSH_MS = 5000;
const FLUSH_AT = 10;

let ctx: { leadId?: string; variant: string; page: string } = { variant: 'book', page: 'short' };
let queue: TrackEvent[] = [];
let timer: number | undefined;
let sid = '';
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

const endpoint = () => import.meta.env.VITE_TRACK_URL || '';
const optedOut = () => {
  if (typeof navigator === 'undefined') return true;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  return n.doNotTrack === '1' || n.msDoNotTrack === '1' || n.globalPrivacyControl === true;
};

function sessionId(): string {
  if (sid) return sid;
  try {
    sid = sessionStorage.getItem('fc-sid') || '';
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
      sessionStorage.setItem('fc-sid', sid);
    }
  } catch {
    sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return sid;
}

function utm() {
  const q = new URLSearchParams(window.location.search);
  const g = (k: string) => (q.get(k) || '').slice(0, 80) || null;
  return { source: g('utm_source'), medium: g('utm_medium'), campaign: g('utm_campaign'), content: g('utm_content') };
}

export function initTracking(c: { leadId?: string; variant: string; page?: string }) {
  ctx = { leadId: c.leadId, variant: c.variant, page: c.page || 'short' };
}

export function nowMs(): number {
  return Math.round(performance.now() - t0);
}

export function track(n: string, p?: Record<string, Scalar>) {
  const ev: TrackEvent = { n, t: nowMs(), ...(p ? { p } : {}) };
  const w = window as Window;
  (w.__fourceeEvents ||= []).push(ev);
  if (w.__fourceeEvents.length > MAX_LOCAL) w.__fourceeEvents.shift();
  if (!endpoint() || optedOut()) return;
  queue.push(ev);
  if (queue.length >= FLUSH_AT) flush();
  else if (timer === undefined) timer = window.setTimeout(flush, FLUSH_MS);
}

export function flush() {
  if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; }
  if (!queue.length || !endpoint() || optedOut()) { queue = []; return; }
  const body = JSON.stringify({
    v: 1,
    sid: sessionId(),
    lead_id: ctx.leadId || null,
    variant: ctx.variant,
    page: ctx.page,
    vw: window.innerWidth,
    vh: window.innerHeight,
    mobile: window.matchMedia?.('(max-width: 767px)').matches ?? false,
    ref: document.referrer ? (() => { try { return new URL(document.referrer).hostname; } catch { return null; } })() : null,
    utm: utm(),
    events: queue,
  });
  queue = [];
  try {
    if (navigator.sendBeacon?.(endpoint(), new Blob([body], { type: 'text/plain;charset=UTF-8' }))) return;
  } catch { /* fall through */ }
  fetch(endpoint(), { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }).catch(() => {});
}

/** Scroll depth (25/50/75/100), engagement, dwell and exit. Returns a cleanup. */
export function startPageMetrics(): () => void {
  const fired = new Set<number>();
  let maxPct = 0;
  let engaged = false;
  const markEngaged = (why: string) => { if (!engaged) { engaged = true; track('engaged', { why }); } };
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const doc = document.documentElement;
      const total = doc.scrollHeight - window.innerHeight;
      const pct = total <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / total) * 100));
      if (pct > maxPct) maxPct = pct;
      for (const m of [25, 50, 75, 100]) if (pct >= m && !fired.has(m)) { fired.add(m); track('scroll_depth', { pct: m }); }
      if (pct >= 10) markEngaged('scroll');
    });
  };
  const onPointer = () => markEngaged('tap');
  const eng15 = window.setTimeout(() => track('dwell_15s'), 15000);
  const hide = () => { track('page_hide', { dwell_ms: nowMs(), max_scroll_pct: maxPct, engaged }); flush(); };
  const onVis = () => { if (document.visibilityState === 'hidden') hide(); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true, once: true });
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', hide);
  onScroll();
  return () => {
    window.clearTimeout(eng15);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointerdown', onPointer);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', hide);
  };
}
