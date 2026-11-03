import React, { useEffect, useState } from 'react';
import { fetchPayOptions, fetchPayStatus, paymentsEnabledInBuild, parsePayReturn, startCheckout, type PayChoice, type PayStatus } from '../../lib/checkout-client';

/** "Pay now (test mode)" buttons, shown only when the build flag AND the server say payments are on. Mobile-first: full-width 48px buttons. */
export const PayOnline: React.FC<{ leadId: string }> = ({ leadId }) => {
  const [choices, setChoices] = useState<PayChoice[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!paymentsEnabledInBuild()) return;
    let live = true;
    fetchPayOptions().then((o) => { if (live && o.enabled) setChoices(o.choices); });
    return () => { live = false; };
  }, []);
  if (!choices.length) return null;
  const go = async (c: PayChoice) => {
    const key = `${c.provider}:${c.currency}`;
    setBusy(key); setError(null);
    const r = await startCheckout(leadId, c);
    if (r.ok === false) { setBusy(null); setError(r.message); return; }
    window.location.assign(r.url);
  };
  return (
    <div data-testid="pay-online" className="mx-auto max-w-md space-y-3 rounded-2xl border border-dashed border-amber-500/60 bg-amber-50/70 p-4 text-left dark:bg-amber-950/20">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">Test mode · no real money moves</p>
      <p className="text-sm text-navy-700 dark:text-navy-300">Want to try paying online instead of waiting for an invoice? Choose a method:</p>
      {choices.map((c) => {
        const key = `${c.provider}:${c.currency}`;
        return (
          <button key={key} type="button" data-testid={`pay-${c.provider}-${c.currency.toLowerCase()}`} disabled={!!busy} onClick={() => void go(c)}
            className="fx-btn fx-btn-primary w-full min-h-12 text-center disabled:opacity-60">
            {busy === key ? 'Opening…' : `${c.label} · pay in ${c.currency}`}
          </button>
        );
      })}
      {error ? <p role="alert" data-testid="pay-error" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    </div>
  );
};

/** After the provider redirects back (?pay=success|cancel&lead=...): confirms what OUR server recorded (the webhook is the source of truth). */
export const PayReturnBanner: React.FC = () => {
  const ret = typeof window !== 'undefined' ? parsePayReturn(window.location.search) : null;
  const [status, setStatus] = useState<PayStatus | 'checking'>('checking');
  useEffect(() => {
    if (!ret) return;
    let live = true; let tries = 0;
    const tick = async () => {
      const s = await fetchPayStatus(ret.leadId);
      if (!live) return;
      setStatus(s);
      if (s !== 'paid' && ret.result === 'success' && ++tries < 8) setTimeout(tick, 1500); // the webhook can land a moment after the redirect
    };
    void tick();
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!ret) return null;
  const text = status === 'paid' ? 'Test payment received. Thank you, nothing real was charged.'
    : ret.result === 'cancel' ? 'Payment cancelled. Nothing was charged. You can try again or wait for your invoice.'
    : status === 'checking' || status === 'pending' ? 'Confirming your test payment…'
    : 'We have not seen the payment yet. If you paid, it will show up shortly; we will confirm by email.';
  return <p role="status" data-testid="pay-banner" data-status={status} className="mb-4 rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">{text}</p>;
};
