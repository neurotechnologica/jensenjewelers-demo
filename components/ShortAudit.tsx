import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditData } from '../types/audit';
import {
  formatAuditCurrency,
  isPlaceholderBusinessName,
  loadAuditContent,
  resolveBusinessLogo,
} from '../lib/audit-content';
import {
  bookingUrl,
  CTA_LABEL,
  OFFER_LINE,
  onboardingUrl,
  readProof,
  resolveCtaVariant,
  type CtaVariant,
} from '../lib/cro';
import { initTracking, nowMs, startPageMetrics, track } from '../lib/track';
import { requestDemoCall, turnstileSiteKey } from '../lib/demo-client';
import { Turnstile } from './ui/turnstile';

/**
 * The short prospect page: one outcome line, the prospect's own audit number, ONE primary CTA, a sticky mobile CTA,
 * proof, and everything else behind <details> accordions. No splash gate, no 3D, no charts: this chunk imports only React.
 * All numbers come from the same per-prospect /content.json the long pages use (no new required keys).
 */

const COUNTRIES = [
  { code: '+27', label: 'ZA +27' },
  { code: '+1', label: 'US/CA +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+61', label: 'AU +61' },
  { code: '+971', label: 'AE +971' },
  { code: '+91', label: 'IN +91' },
];

const INK = '#0c0b09';
const CREAM = '#faf5ea';
const GOLD = '#8a6a2c';

const Chevron = () => (
  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg>
);
const PhoneIcon = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
);

function Accordion({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <details
      className="group border-b border-[#0c0b09]/15"
      onToggle={(e) => track('accordion', { id, open: (e.currentTarget as HTMLDetailsElement).open })}
    >
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 py-3 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <Chevron />
      </summary>
      <div className="pb-5 text-[15px] leading-relaxed text-[#3a342b]">{children}</div>
    </details>
  );
}

/** "hear" variant: inline demo-call form. Goes through the guarded same-origin /api/demo-call (lib/demo-client, P0.2); the browser never calls n8n. */
function HearForm({ leadId, defaultCode }: { leadId?: string; defaultCode?: string }) {
  const [code, setCode] = useState(COUNTRIES.find((c) => c.code === defaultCode)?.code ?? '+27');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle' | 'calling' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const started = useRef(false);
  const [trap, setTrap] = useState(''); // honeypot (hidden); bots fill it
  const [token, setToken] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const siteKey = turnstileSiteKey();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    track('form_submit', { form: 'demo_call' });
    setStatus('calling'); setMsg('');
    const r = await requestDemoCall({ phone, country: code, leadId, website: trap, turnstileToken: token });
    if (r.ok === true) { setStatus('ok'); track('form_success', { form: 'demo_call' }); return; }
    const fail = r as { code: string; message: string };
    setStatus('err'); setMsg(fail.message);
    track('form_error', { form: 'demo_call', reason: fail.code === 'bad_phone' ? 'invalid_number' : fail.code });
    if (siteKey && fail.code !== 'bad_phone') { setToken(''); setResetKey((k) => k + 1); } // a Turnstile token is single-use (not consumed by client-side validation)
  };

  if (status === 'ok') return <p role="status" className="rounded-xl bg-white/80 p-4 text-[16px] font-medium">Calling you now. Pick up to hear your AI receptionist.</p>;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#0c0b09]/15 bg-white/85 p-4" aria-label="Hear your AI receptionist" data-testid="hear-form">
      <label htmlFor="fc-phone" className="mb-2 block text-[14px] font-medium">Your mobile number: we call you once, now.</label>
      <div className="flex gap-2">
        <select aria-label="Country code" value={code} onChange={(e) => setCode(e.target.value)} className="h-12 w-[104px] shrink-0 rounded-xl border border-[#0c0b09]/25 bg-white px-2" style={{ fontSize: 16 }}>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input
          id="fc-phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="082 123 4567" value={phone}
          onFocus={() => { if (!started.current) { started.current = true; track('form_start', { form: 'demo_call' }); } }}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d\s()+-]/g, '').slice(0, 20))}
          className="h-12 min-w-0 flex-1 rounded-xl border border-[#0c0b09]/25 bg-white px-3" style={{ fontSize: 16 }}
        />
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>
      <div className="mt-3"><Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} theme="light" /></div>
      {msg && <p role="alert" className="mt-2 text-[14px] text-[#9a1c1c]">{msg}</p>}
      <button type="submit" disabled={status === 'calling' || (!!siteKey && !token)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0c0b09] text-[16px] font-semibold text-[#faf5ea] disabled:opacity-60">
        <PhoneIcon />{status === 'calling' ? 'Calling…' : 'Call me now'}
      </button>
      <p className="mt-2 text-[12px] leading-snug text-[#5b5346]">One demo call to this number, for product demonstration. By requesting it you consent to that call.</p>
    </form>
  );
}

export default function ShortAudit() {
  const [data, setData] = useState<AuditData | null>(null);
  const [failed, setFailed] = useState(false);
  const [variant] = useState<CtaVariant>(() => resolveCtaVariant());
  const [formOpen, setFormOpen] = useState(false);
  const [heroCtaSeen, setHeroCtaSeen] = useState(true);
  const [finalSeen, setFinalSeen] = useState(false);
  const heroCta = useRef<HTMLDivElement>(null);
  const finalCta = useRef<HTMLDivElement>(null);
  const ctaViewed = useRef(false);
  const label = CTA_LABEL[variant];

  useEffect(() => {
    document.title = 'Your phone audit · Fourcee';
    return startPageMetrics();
  }, []);

  useEffect(() => {
    let live = true;
    loadAuditContent()
      .then((d) => { if (live) { setData(d); initTracking({ leadId: d.lead_id, variant }); track('page_view', { content: true }); } })
      .catch(() => { if (live) { setFailed(true); initTracking({ variant }); track('page_view', { content: false }); } });
    return () => { live = false; };
  }, [variant]);

  // CTA visibility: drives the sticky mobile bar and the "time to CTA" metric
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (en.target === heroCta.current) {
          setHeroCtaSeen(en.isIntersecting);
          if (en.isIntersecting && !ctaViewed.current) { ctaViewed.current = true; track('cta_view', { pos: 'hero', time_to_cta_ms: nowMs() }); }
        } else if (en.target === finalCta.current) setFinalSeen(en.isIntersecting);
      }
    }, { threshold: 0.6 });
    if (heroCta.current) io.observe(heroCta.current);
    if (finalCta.current) io.observe(finalCta.current);
    return () => io.disconnect();
  }, [data, failed]);

  const click = useCallback((pos: 'hero' | 'sticky' | 'final') => {
    track('cta_click', { pos, variant, time_to_click_ms: nowMs() });
    if (variant === 'hear') {
      setFormOpen(true);
      if (pos !== 'hero') window.setTimeout(() => heroCta.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    }
  }, [variant]);

  const name = data && !isPlaceholderBusinessName(data.business?.name) ? data.business.name : null;
  const proof = data ? readProof(data) : null;
  const fmt = (n: number) => (data ? formatAuditCurrency(data, n) : String(n));
  const logo = data ? resolveBusinessLogo(data) : '';
  const href = variant === 'golive' ? onboardingUrl() : bookingUrl();
  const showCta = variant === 'hear' || Boolean(href);

  // plain render function (not a component): keeps the DOM node stable across re-renders so focus / IntersectionObserver refs survive
  const cta = (pos: 'hero' | 'sticky' | 'final', ref?: React.Ref<HTMLDivElement>) => {
    if (!showCta) return null;
    const cls = 'flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl px-5 text-center text-[17px] font-semibold shadow-[0_10px_30px_rgba(12,11,9,0.25)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8a6a2c]';
    const style = { background: INK, color: CREAM };
    return (
      <div ref={ref} data-cta-pos={pos}>
        {variant === 'hear' ? (
          <button type="button" className={cls} style={style} aria-expanded={formOpen} onClick={() => click(pos)}><PhoneIcon />{label}</button>
        ) : (
          <a className={cls} style={style} href={href} target="_blank" rel="noopener noreferrer" onClick={() => click(pos)}>{label}</a>
        )}
      </div>
    );
  };

  const stickyOn = !heroCtaSeen && !finalSeen;

  // Until content.json arrives show only a fixed-height skeleton (header + hero-sized block); everything else mounts afterwards,
  // below the hero, so nothing visible moves when the data lands (CLS).
  if (!data && !failed) {
    return (
      <main className="min-h-[100svh]" style={{ background: CREAM, color: INK }} data-testid="short-audit" data-variant={variant} aria-busy="true">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-4 md:px-8 md:pt-6">
          <span className="text-[13px] font-bold tracking-[0.28em]">FOURCEE</span>
          <span className="h-8 w-8" />
        </header>
        <div className="mx-auto max-w-5xl px-5 pt-5 md:px-8 md:pt-12"><div className="min-h-[460px] rounded-2xl bg-[#0c0b09]/[0.04]" aria-hidden /></div>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] pb-[calc(88px+env(safe-area-inset-bottom))] md:pb-16" style={{ background: CREAM, color: INK }} data-testid="short-audit" data-variant={variant}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-4 md:px-8 md:pt-6">
        <span className="text-[13px] font-bold tracking-[0.28em]">FOURCEE</span>
        {logo ? <img src={logo} alt="" width={32} height={32} loading="lazy" decoding="async" fetchPriority="low" className="h-8 w-8 rounded-md object-contain" /> : <span className="h-8" />}
      </header>

      {/* 1. Hero: one outcome line + the prospect's own number + ONE CTA */}
      <section className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-6 px-5 pb-8 pt-5 md:grid-cols-2 md:items-center md:gap-12 md:px-8 md:pt-12" data-testid="hero">
        <div>
          <p className="mb-2 min-h-[18px] text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: GOLD }}>
            {name ? `Audit prepared for ${name}` : 'Your phone audit'}
          </p>
          <h1 className="text-[30px] font-semibold leading-[1.08] tracking-tight md:text-[44px]" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Answer the calls {name ?? 'your business'} is missing.
          </h1>

          {/* 10-second proof (their own audit number) */}
          {proof && (
            <div className="mt-5 rounded-2xl border border-[#0c0b09]/15 bg-white/80 p-4" data-testid="proof">
              <p className="text-[34px] font-bold leading-none tracking-tight md:text-[40px]">{fmt(proof.lossMin)}–{fmt(proof.lossMax)}</p>
              <p className="mt-2 text-[15px] leading-snug text-[#3a342b]">
                estimated revenue a month walking out unanswered.
              </p>
              <p className="mt-1 text-[12px] leading-snug text-[#5b5346]">{data?.compliance?.disclaimerShort || 'Estimate based on public data and benchmarks'}</p>
            </div>
          )}

          <div className="mt-5">
            {cta('hero', heroCta)}
            <p className="mt-2 text-center text-[13px] text-[#3a342b]">{OFFER_LINE}</p>
          </div>
          {variant === 'hear' && formOpen && <div className="mt-4"><HearForm leadId={data?.lead_id} defaultCode={data?.liveDemo?.phoneCountryDefault} /></div>}
        </div>

        {proof && proof.inboundMax > 0 && (
          <dl className="hidden grid-cols-3 gap-3 text-center md:grid md:gap-4" data-testid="stats">
            {[
              [`${proof.inboundMin}–${proof.inboundMax}`, 'calls a week'],
              [`${proof.answerMin}–${proof.answerMax}%`, 'answered today (est.)'],
              [`${proof.missedMin}–${proof.missedMax}`, 'missed a week (est.)'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-[#0c0b09]/10 bg-white/60 px-2 py-4">
                <dd className="text-[22px] font-bold leading-none md:text-[28px]">{v}</dd>
                <dt className="mt-2 text-[12px] leading-tight text-[#5b5346]">{l}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      <div className="mx-auto max-w-3xl px-5 md:px-8">
        {/* 2. What happens next: three steps, truthful (done-for-you, founder-assisted) */}
        <section aria-labelledby="fc-how" className="py-6">
          <h2 id="fc-how" className="mb-3 text-[20px] font-semibold">What happens next</h2>
          <ol className="grid gap-3 text-[15px] leading-snug">
            {[
              ['Walk through this audit', 'A short call.'],
              ['We set it up for you', 'No caller hears it until you sign off.'],
              ['Live within days', 'You keep the controls.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold" style={{ background: INK, color: CREAM }}>{i + 1}</span>
                <span><b>{t}.</b> <span className="text-[#3a342b]">{d}</span></span>
              </li>
            ))}
          </ol>
        </section>

        {/* 3. Social proof: only what the audit actually contains (their own public reviews) */}
        {proof?.rating && proof.reviews ? (
          <section aria-label="Your reviews" className="my-2 rounded-2xl border border-[#0c0b09]/10 bg-white/60 p-4" data-testid="social-proof">
            <p className="text-[15px] font-semibold">Your customers already rate you {proof.rating}★ ({proof.reviews} Google reviews).</p>
            {data?.reviews?.quote1 && <p className="mt-1 text-[15px] italic text-[#3a342b]">“{data.reviews.quote1}”</p>}
            <p className="mt-1 text-[13px] text-[#5b5346]">Every unanswered call is a customer who never gets the chance to leave a review like that.</p>
          </section>
        ) : null}

        {/* 4. Detail on demand */}
        <section aria-label="More detail" className="mt-4 border-t border-[#0c0b09]/15" data-testid="details">
          {proof ? (
            <Accordion id="audit-breakdown" title="What the audit found">
              {proof.inboundMax > 0 && (
                <p className="mb-3">About {proof.inboundMin}–{proof.inboundMax} calls a week, {proof.answerMin}–{proof.answerMax}% answered today, {proof.missedMin}–{proof.missedMax} missed (all estimates).</p>
              )}
              {data?.breakdown?.rows?.length ? (
                <ul className="grid gap-2">
                  {data.breakdown.rows.map((r) => (
                    <li key={r.callType} className="flex justify-between gap-3"><span>{r.callType}: {r.weeklyMissedMin}–{r.weeklyMissedMax} missed a week</span><span className="font-semibold text-[#0c0b09]">{fmt(r.monthlyImpactMin)}–{fmt(r.monthlyImpactMax)}/mo</span></li>
                  ))}
                </ul>
              ) : null}
              {data?.compliance?.dataSourceLine && <p className="mt-2 text-[12px] text-[#5b5346]">{data.compliance.dataSourceLine}</p>}
            </Accordion>
          ) : null}
          <Accordion id="what-it-does" title="What the AI receptionist does for you">
            {data?.recoveryPlan?.body && <p>{data.recoveryPlan.body}</p>}
            <ul className="mt-2 list-disc pl-5">
              {(data?.recoveryPlan?.capabilities?.length ? data.recoveryPlan.capabilities : ['Answers calls day and night', 'Books appointments', 'Answers common questions', 'Passes callers to your team when needed']).map((c) => <li key={c}>{c}</li>)}
            </ul>
          </Accordion>
          <Accordion id="setup" title="How setup works">
            <p>We do the setup. You give us access to your calendar and CRM and tell us how you want calls handled; we build it, you test it, and it only goes live when you approve. Pricing is walked through on the call, with no lock-in.</p>
          </Accordion>
          <Accordion id="faq-team" title="Does this replace my front-desk team?">
            <p>No. It covers after-hours, overflow and repetitive questions so your team can focus on clients in the showroom. You choose when it answers and when it routes straight to a person.</p>
          </Accordion>
          <Accordion id="faq-voice" title="What if I do not like the voice?">
            <p>Voice, pacing and phrasing are tuned during setup until it sounds like your showroom answering. Revisions are included in the setup phase.</p>
          </Accordion>
        </section>

        {/* 5. Final CTA (the same single action) */}
        <section className="py-8" data-testid="final-cta">
          <h2 className="mb-3 text-[22px] font-semibold leading-tight">Ready to stop losing those calls?</h2>
          {cta('final', finalCta)}
          <p className="mt-2 text-center text-[13px] text-[#3a342b]">{OFFER_LINE}</p>
        </section>

        <footer className="border-t border-[#0c0b09]/15 pb-6 pt-4 text-[12px] leading-relaxed text-[#5b5346]">
          <p>{data?.compliance?.disclaimerLong || 'Figures are estimates based on public data and industry benchmarks, not a guarantee of results.'}</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a className="underline" href="#/audit" onClick={() => track('nav', { to: 'full_report' })}>See the full report</a>
            <a className="underline" href="#/home" onClick={() => track('nav', { to: 'full_overview' })}>Full overview</a>
            <a className="underline" href="#/terms" onClick={() => track('nav', { to: 'terms' })}>Terms</a>
          </p>
        </footer>
      </div>

      {/* Sticky mobile CTA: appears once the hero CTA has scrolled away, hides again next to the final CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#0c0b09]/15 bg-[#faf5ea]/95 px-4 pt-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', transform: stickyOn ? 'translateY(0)' : 'translateY(110%)', visibility: stickyOn ? 'visible' : 'hidden', transition: 'transform .2s ease, visibility .2s' }}
        data-testid="sticky-cta"
        aria-hidden={!stickyOn || !showCta}
        hidden={!showCta}
      >
        {cta('sticky')}
      </div>

      {failed && <p className="sr-only" role="status">Audit details could not be loaded.</p>}
    </main>
  );
}
