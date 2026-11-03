import React, { useState } from 'react';
import type { AuditGateBrief } from '../lib/audit-gate-brief';
import { newIdempotencyKey, submitLead } from '../lib/lead-client';
import { leadSubmitUnlocksReport } from '../lib/prospect-fixes';

const COUNTRIES = [
  { code: '+27', label: 'ZA +27' },
  { code: '+1', label: 'US/CA +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+61', label: 'AU +61' },
  { code: '+971', label: 'AE +971' },
  { code: '+91', label: 'IN +91' },
];

interface AuditLeadGateProps {
  brief: AuditGateBrief;
  isDarkMode: boolean;
  onUnlocked: () => void;
}

/**
 * Name, email and phone before the report. The business name and location are read from the
 * injected audit payload and are not editable here. The report body is not mounted, and not
 * fetched, until /api/lead returns JSON {ok:true} (status "sent"). An HTML 200 keeps this form up.
 */
export const AuditLeadGate: React.FC<AuditLeadGateProps> = ({ brief, isDarkMode, onUnlocked }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(brief.phoneCountryDefault || '+27');
  const [phone, setPhone] = useState('');
  const [trap, setTrap] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const businessName = brief.businessName;
  const location = brief.location;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const digits = phone.replace(/\D/g, '');
    if (trimmedName.length < 2) { setError('Please enter your name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) { setError('Please enter a valid email.'); return; }
    if (digits.length < 7 || digits.length > 15) { setError('Please enter a phone number.'); return; }
    setError('');
    setSending(true);
    const result = await submitLead({
      name: trimmedName,
      email: trimmedEmail,
      phone: `${code} ${phone.trim()}`,
      store: businessName,
      plan: 'audit',
      billing_cycle: 'monthly',
      notes: 'Audit report request',
      crm: '',
      total: null,
      currency: brief.currencyCode || 'USD',
      website: trap,
      idempotency_key: newIdempotencyKey(),
      page_url: typeof window !== 'undefined' ? window.location.href : '',
    });
    setSending(false);
    if (!leadSubmitUnlocksReport(result.status)) {
      const first = result.status === 'invalid' ? Object.values(result.fields)[0] : '';
      const queued = result.status === 'queued' ? result.error : '';
      setError(first || queued || 'Please check the form and try again.');
      return;
    }
    onUnlocked();
  };

  const ink = isDarkMode ? 'text-slate-100' : 'text-navy-900';
  const muted = isDarkMode ? 'text-slate-300' : 'text-navy-700';

  return (
    <section className="relative z-20 mx-auto w-full max-w-lg px-4 pb-28 pt-8 sm:pt-12" data-testid="audit-lead-gate">
      <div className={`rounded-[1.75rem] border p-6 sm:p-8 ${isDarkMode ? 'border-white/15 bg-navy-950/80' : 'border-[#d9c39a]/80 bg-[#faf5ea] shadow-[0_18px_50px_rgba(12,11,9,0.08)]'}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#8a7349]">Confidential audit</p>
        <h1 className={`mt-3 font-sans text-2xl font-semibold normal-case leading-tight tracking-normal sm:text-3xl ${ink}`}>
          {brief.preparedForLabel} {businessName}
        </h1>
        <p className={`mt-2 text-sm ${muted}`}>{location}</p>
        <p className={`mt-4 text-sm leading-relaxed ${muted}`}>
          Leave your details and we will open the report prepared for this showroom. We use them to send the brief and one follow-up. No card details.
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-3" noValidate>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-navy-700" htmlFor="audit-lead-name">
            Name
            <input
              id="audit-lead-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-3 text-base text-navy-900"
              style={{ fontSize: 16 }}
            />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-navy-700" htmlFor="audit-lead-email">
            Email
            <input
              id="audit-lead-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3 py-3 text-base text-navy-900"
              style={{ fontSize: 16 }}
            />
          </label>
          <div>
            <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-navy-700">Phone</span>
            <div className="mt-1.5 flex gap-2">
              <select
                aria-label="Country code"
                value={code}
                onChange={(ev) => setCode(ev.target.value)}
                className="h-12 w-[118px] shrink-0 rounded-xl border border-navy-200 bg-white px-2 text-base text-navy-900"
                style={{ fontSize: 16 }}
              >
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input
                id="audit-lead-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="082 123 4567"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value.replace(/[^\d\s()+-]/g, '').slice(0, 20))}
                className="h-12 min-w-0 flex-1 rounded-xl border border-navy-200 bg-white px-3 text-base text-navy-900"
                style={{ fontSize: 16 }}
              />
            </div>
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label htmlFor="audit-lead-website">Website</label>
            <input id="audit-lead-website" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(ev) => setTrap(ev.target.value)} />
          </div>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={sending}
            className="fx-btn fx-btn-primary mt-2 w-full disabled:opacity-60"
          >
            {sending ? 'Opening…' : 'View my report'}
          </button>
        </form>
      </div>
    </section>
  );
};
