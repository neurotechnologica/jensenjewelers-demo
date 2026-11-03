import React, { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '../lib/asset-url';
import type { RingBuilderConfig } from '../types/audit';
import { LazyRingBuilderSection } from './LazyRingBuilderSection';
import {
  HANDOVER_ITEMS,
  ONBOARD_STEPS,
  SOP_CHECKS,
  STATUS_LABEL,
  buildHistoryTranscript,
  seedCalls,
  type ActionState,
  type CallStatus,
  type OpsCall,
  type TranscriptLine,
} from '../lib/voice-ops';

interface CRMViewProps {
  isDarkMode?: boolean;
  businessName?: string;
  reportId?: string;
  location?: string;
  ringBuilder?: Required<RingBuilderConfig>;
}

type PortalTab = 'calls' | 'onboard' | 'handover' | 'studio';

interface LeadLog {
  id: string;
  time: string;
  customerName: string;
  intent: string;
  status: string;
  transcript: TranscriptLine[];
}

const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function statusTone(status: string, isDarkMode: boolean) {
  if (status === 'live') return isDarkMode ? 'text-emerald-300' : 'text-emerald-700';
  if (status === 'booked' || status.includes('Booked')) return isDarkMode ? 'text-[#e8d5a8]' : 'text-amber-800';
  if (status === 'follow_up' || status === 'escalated') return isDarkMode ? 'text-sky-300' : 'text-sky-800';
  return isDarkMode ? 'text-white/60' : 'text-navy-600';
}

function actionTone(state: ActionState, isDarkMode: boolean) {
  if (state === 'done') return isDarkMode ? 'text-emerald-300' : 'text-emerald-700';
  if (state === 'pending') return isDarkMode ? 'text-[#e8d5a8]' : 'text-amber-800';
  return isDarkMode ? 'text-white/40' : 'text-navy-400';
}


/** Jewelry business prefill templates — clearly labeled; never presented as live CRM data. */
const ONBOARD_TEMPLATES: { id: string; label: string; blurb: string; hours: string; integrations: string; voice: string; review: string }[] = [
  {
    id: 'bridal-boutique',
    label: 'Bridal boutique',
    blurb: 'Template · prefill',
    hours: 'Tue–Sat 10:00–18:00. Closed Sun–Mon. After 18:00 the voice greets, takes a callback request, and texts the floor manager — no live transfers after hours unless the ticket looks over $8k.',
    integrations: 'Bridal appointments on Google Calendar (owner: bridal@). CRM is HubSpot. Stone lookups go through Nivoda. Confirmation SMS via Twilio. WhatsApp is off for this shop.',
    voice: 'Warm, unhurried, never quote a firm price on the line. Escalate to a human for custom redesign, estate appraisal, or any legal/financing question. Greeting must open with the store name and “bridal concierge”.',
    review: 'Front desk Tue–Sat · after-hours callback + SMS · Google Calendar bridal · HubSpot · Nivoda · escalate custom / estate / >$8k · greeting: bridal concierge.',
  },
  {
    id: 'multi-location',
    label: 'Multi-location group',
    blurb: 'Template · prefill',
    hours: 'Each store keeps its own hours in the packet. Default: Mon–Fri 10–19, Sat 10–17, Sun closed. After-hours routes to the on-call store manager for that location only.',
    integrations: 'Shared Salesforce CRM, per-store Google Calendars, Nivoda for diamond hold, Shopify for e-com order status, WhatsApp Business for the flagship city only.',
    voice: 'Neutral luxury tone. Never invent stock across stores — confirm location before promising a viewing. Escalate VIP names on the private list and any repair over $2k.',
    review: 'Per-store hours · Salesforce · calendars per location · Nivoda · Shopify orders · WhatsApp flagship only · no cross-store stock promises.',
  },
  {
    id: 'high-jewelry',
    label: 'High jewelry salon',
    blurb: 'Template · prefill',
    hours: 'By appointment Tue–Sat 11:00–19:00. Walk-ins politely offered the next open salon slot. After hours: voicemail + encrypted SMS to the director — never auto-book.',
    integrations: 'Private Outlook calendar for the salon director. Soft CRM notes in Notion until handover. No public inventory API — stones described only as “available for private viewing”.',
    voice: 'Quiet, precise, multilingual if asked (EN/FR). Never discuss discounts. Escalate any press, celebrity, or security-sensitive inquiry immediately.',
    review: 'Appointment-only · Outlook director calendar · Notion notes · no public inventory · escalate press / VIP / security · no discounts on the line.',
  },
  {
    id: 'repair-workshop',
    label: 'Repair + custom workshop',
    blurb: 'Template · prefill',
    hours: 'Mon–Fri 9:00–17:30. Saturday drop-off 10–14. After hours: log the repair request and promise a callback next business morning.',
    integrations: 'Job tickets in Jewel360 / Orderry. Customer SMS status updates. Calendar for fitting appointments only. Nivoda used only when a replacement stone is needed.',
    voice: 'Practical and clear. Always ask for ticket number or approx drop-off date. Never promise a finish date without checking the bench. Escalate insurance claims and lost-stone reports.',
    review: 'Bench hours · Jewel360 tickets · SMS status · fitting calendar · Nivoda for replacements · escalate insurance / lost stone · no finish-date guesses.',
  },
];

export const CRMView: React.FC<CRMViewProps> = ({
  isDarkMode = true,
  businessName = 'PLACEHOLDER Business',
  reportId,
  location,
  ringBuilder,
}) => {
  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    try {
      const t = window.sessionStorage.getItem('fourcee-crm-tab');
      if (t === 'onboard' || t === 'calls' || t === 'handover' || t === 'studio') {
        window.sessionStorage.removeItem('fourcee-crm-tab');
        return t;
      }
    } catch {}
    return 'calls';
  });
  const [revenueSaved] = useState(125500);
  const [appointmentsBooked] = useState(48);
  const [logEntries] = useState<LeadLog[]>([]);
  const [liveSeconds, setLiveSeconds] = useState(98);
  const [waveHeights, setWaveHeights] = useState<number[]>([12, 20, 15, 25, 14, 22, 10, 24, 16, 19, 12, 21]);
  const [selectedKey, setSelectedKey] = useState<string>('call-1');
  const [opsClock, setOpsClock] = useState(() => new Date());
  const [channelLoad] = useState({ voice: 2, sms: 1, web: 0 });
  const [onboardStep, setOnboardStep] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [plainEnglish, setPlainEnglish] = useState('');
  const [signed, setSigned] = useState(true);

  const calls = useMemo(() => seedCalls(businessName), [businessName]);
  const liveCalls = useMemo(() => calls.filter((call) => call.status === 'live'), [calls]);
  const closedCalls = useMemo(() => calls.filter((call) => call.status !== 'live'), [calls]);

  const simulatedNames = useMemo(
    () => ['Amelia Stone', 'Noah Patel', 'Harper Wellington', 'Mason Brooks', 'Sophia Vale', 'Ethan Rhodes'],
    []
  );
  const simulatedIntents = useMemo(
    () => [
      'Oval Diamond Query',
      'Halo Ring Consultation',
      'Emerald Cut Upgrade',
      'Lab-Grown Bridal Request',
      'Custom Setting Appointment',
    ],
    []
  );

  const selectedCall: OpsCall | null = useMemo(() => {
    if (selectedKey.startsWith('log:')) return null;
    return calls.find((call) => call.id === selectedKey) ?? calls[0];
  }, [selectedKey, calls]);

  const selectedLog = useMemo(() => {
    if (!selectedKey.startsWith('log:')) return null;
    return logEntries.find((entry) => entry.id === selectedKey.slice(4)) ?? null;
  }, [selectedKey, logEntries]);

  const displayConversation = useMemo(() => {
    if (selectedLog) {
      return {
        id: selectedLog.id,
        customerName: selectedLog.customerName,
        intent: selectedLog.intent,
        status: selectedLog.status,
        isLive: false,
        transcript: selectedLog.transcript,
        actions: [] as OpsCall['actions'],
      };
    }
    const call = selectedCall ?? calls[0];
    return {
      id: call.id,
      customerName: call.customerName,
      intent: call.intent,
      status: STATUS_LABEL[call.status as CallStatus] ?? call.status,
      isLive: call.status === 'live',
      transcript: call.transcript,
      actions: call.actions,
    };
  }, [selectedLog, selectedCall, calls]);

  // Sample data is STATIC on purpose: no timers inventing leads, revenue or bookings (a prospect must never mistake the walkthrough for live results).

  useEffect(() => {
    const liveTicker = setInterval(() => setLiveSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(liveTicker);
  }, []);

  useEffect(() => {
    const waveInterval = setInterval(() => {
      setWaveHeights((prev) => prev.map(() => 10 + Math.round(Math.random() * 24)));
    }, 320);
    return () => clearInterval(waveInterval);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setOpsClock(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const liveDuration = `${String(Math.floor(liveSeconds / 60)).padStart(2, '0')}:${String(liveSeconds % 60).padStart(2, '0')}`;
  const heard = useMemo(() => parsePlainEnglish(plainEnglish), [plainEnglish]);

  const pageClass = isDarkMode ? 'text-[#f3ebe0]' : 'text-navy-900';
  const tabShellClass = isDarkMode
    ? 'rounded-full border border-white/10 bg-black/50 p-1 backdrop-blur-xl'
    : 'rounded-full border border-slate-200 bg-slate-100/95 p-1 shadow-sm';
  const tabActiveClass = isDarkMode
    ? 'bg-gradient-to-r from-[#e8d5a8] to-[#c8b58f] text-[#1a140c]'
    : 'bg-navy-900 text-white';
  const tabInactiveClass = isDarkMode ? 'text-white/70 hover:text-white' : 'text-navy-600 hover:text-navy-900';
  const panelClass = isDarkMode
    ? 'relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-2xl'
    : 'relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-4 shadow-sm';
  const muted = isDarkMode ? 'text-white/55' : 'text-navy-500';
  const ink = isDarkMode ? 'text-white' : 'text-navy-900';

  return (
    <div className={`relative min-h-screen px-4 py-6 md:px-8 md:py-8 ${pageClass}`}>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: isDarkMode
            ? `linear-gradient(180deg, rgba(4,12,20,0.55), rgba(4,12,20,0.78)), url("${assetUrl('assets/plates/plate_hud_atmosphere.png')}") center / cover no-repeat`
            : undefined,
        }}
        aria-hidden
      />
      {isDarkMode && <div className="fx-grid z-0" aria-hidden />}

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 ${
            isDarkMode
              ? 'border-amber-300/40 bg-amber-950/35 text-amber-100'
              : 'border-amber-500/40 bg-amber-50 text-amber-950'
          }`}
          role="status"
          data-testid="ops-sample-banner"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
            SAMPLE DATA — not real calls, not connected to your CRM
          </p>
          <p className={`text-[11px] ${isDarkMode ? 'text-amber-100/80' : 'text-amber-900/80'}`}>
            Illustrative walkthrough only. Nothing here is a real call, result or customer. Figures do not change or update.
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="fx-kicker">
              Voice agent · DEMO
              {location ? ` · ${location}` : ''}
            </p>
            <h1 className={`fx-hud mt-2 text-[13px] md:text-sm ${isDarkMode ? 'text-[#f4efe4]' : 'text-navy-800'}`}>
              Fourcee ops
            </h1>
            <p className={`mt-1 text-[11px] ${muted}`}>
              {businessName} · answer, qualify, act, log. Ring studio is a demo tab only.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className={`font-mono text-[10px] tabular-nums tracking-[0.16em] ${muted}`}>
              {opsClock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              {reportId ? ` · ${reportId}` : ''}
            </p>
            <div className={tabShellClass}>
              {(['calls', 'onboard', 'handover', 'studio'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                    activeTab === tab ? tabActiveClass : tabInactiveClass
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeTab === 'calls' && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'VOICE', load: channelLoad.voice },
                { id: 'SMS', load: channelLoad.sms },
                { id: 'WEB', load: channelLoad.web },
              ].map((ch) => (
                <span key={ch.id} className="fx-chip">
                  <span className={ch.load > 0 ? 'fx-dot' : 'h-1.5 w-1.5 rounded-full bg-slate-500'} />
                  {ch.id} {ch.load.toString().padStart(2, '0')}
                </span>
              ))}
              <span className="fx-chip">SOP · answer → qualify → act → log</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <Kpi label="Recovered (sample)" value={formatMoney(revenueSaved)} isDarkMode={isDarkMode} />
              <Kpi label="Booked today (sample)" value={appointmentsBooked.toString()} isDarkMode={isDarkMode} />
              <Kpi label="Avg handle (sample)" value="1.2m" isDarkMode={isDarkMode} />
              <Kpi label="Follow-ups owed (sample)" value="3" isDarkMode={isDarkMode} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr_0.9fr]">
              <section className={panelClass}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Call log · sample</h3>
                  <p className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>{liveCalls.length} sample open</p>
                </div>
                <div className="space-y-2">
                  {liveCalls.map((call) => (
                    <LogRow
                      key={call.id}
                      title={call.customerName}
                      meta={`${call.intent} · ${call.startedAgo}`}
                      status={call.status}
                      selected={selectedKey === call.id}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(call.id)}
                    />
                  ))}
                  {logEntries.map((entry) => (
                    <LogRow
                      key={entry.id}
                      title={entry.customerName}
                      meta={`${entry.intent} · ${entry.time}`}
                      status={entry.status}
                      selected={selectedKey === `log:${entry.id}`}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(`log:${entry.id}`)}
                    />
                  ))}
                  {closedCalls.map((call) => (
                    <LogRow
                      key={call.id}
                      title={call.customerName}
                      meta={call.intent}
                      status={call.status}
                      selected={selectedKey === call.id}
                      isDarkMode={isDarkMode}
                      onClick={() => setSelectedKey(call.id)}
                    />
                  ))}
                </div>
              </section>

              <aside className={panelClass}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Transcript · sample</h3>
                    <p className={`mt-1 text-[11px] ${muted}`}>
                      {displayConversation.customerName} · {displayConversation.intent}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(displayConversation.status, isDarkMode)}`}>
                    {displayConversation.isLive ? `SAMPLE · in progress ${liveDuration}` : displayConversation.status}
                  </span>
                </div>
                <div className={`mt-3 rounded-xl border px-3 py-2 ${isDarkMode ? 'border-white/10 bg-black/50' : 'border-slate-200 bg-white'}`}>
                  <p className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>Voice activity</p>
                  <div className="mt-2 flex h-8 items-end gap-1">
                    {waveHeights.map((h, i) => (
                      <span
                        key={i}
                        className={`w-1.5 rounded-full ${isDarkMode ? 'bg-emerald-300/80' : 'bg-navy-500/70'}`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>
                </div>
                <div className={`mt-3 max-h-[340px] space-y-2 overflow-auto rounded-xl border p-3 ${isDarkMode ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white'}`}>
                  {displayConversation.transcript.map((row, idx) => (
                    <div key={`${displayConversation.id}-${idx}`} className={`rounded-lg border p-2.5 ${isDarkMode ? 'border-white/5 bg-white/[0.02]' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-semibold ${row.speaker === 'Agent' ? ink : isDarkMode ? 'text-sky-300' : 'text-sky-800'}`}>
                          {row.speaker}
                        </span>
                        <span className={`text-[10px] ${muted}`}>{row.at}</span>
                      </div>
                      <p className={`mt-1 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/85' : 'text-navy-800'}`}>{row.line}</p>
                    </div>
                  ))}
                </div>
              </aside>

              <section className={panelClass}>
                <h3 className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${ink}`}>Actions · status · sample</h3>
                <p className={`mt-2 text-[11px] uppercase tracking-[0.16em] ${statusTone(displayConversation.status, isDarkMode)}`}>
                  {displayConversation.status}
                </p>
                <div className="mt-3 space-y-2">
                  {displayConversation.actions.length === 0 ? (
                    <p className={`text-[12px] ${muted}`}>Closed log — actions already written to CRM.</p>
                  ) : (
                    displayConversation.actions.map((action) => (
                      <div key={action.id} className="flex items-start justify-between gap-2 border-b border-white/5 py-2 last:border-0">
                        <div>
                          <p className={`text-[12px] ${ink}`}>{action.label}</p>
                          {action.detail ? <p className={`text-[11px] ${muted}`}>{action.detail}</p> : null}
                        </div>
                        <span className={`text-[10px] uppercase tracking-[0.14em] ${actionTone(action.state, isDarkMode)}`}>
                          {action.state}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <p className={`mt-4 text-[10px] uppercase tracking-[0.18em] ${muted}`}>SOP check</p>
                <ul className="mt-2 space-y-1">
                  {SOP_CHECKS.map((item) => (
                    <li key={item} className={`text-[11px] ${isDarkMode ? 'text-white/75' : 'text-navy-700'}`}>
                      · {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'onboard' && (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <section className={panelClass}>
              <p className="fx-kicker">
                Client onboarding · {onboardStep + 1} of {ONBOARD_STEPS.length}
              </p>
              <h2 className="fx-display mt-2 text-2xl md:text-3xl">
                {onboardStep === 0
                  ? 'When does the line pick up?'
                  : onboardStep === 1
                    ? 'Which tools does the store already live in?'
                    : onboardStep === 2
                      ? 'What should the voice never do?'
                      : 'Read it back. Correct anything.'}
              </h2>
              <p className={`mt-2 max-w-xl text-[13px] leading-relaxed ${muted}`}>
                {onboardStep === 0
                  ? 'Hours, after-hours, and who owns the phone when the floor is busy. Write it like a text to the manager — or pick a jewelry template below to prefill.'
                  : onboardStep === 1
                    ? 'Calendar, CRM, inventory, WhatsApp, SMS — name the tools in plain English. No API keys on day one. Templates are starting points only.'
                    : onboardStep === 2
                      ? 'Escalate rules, dollar thresholds, languages, and the greeting that must stay in the store’s voice.'
                      : 'We turn the paragraph into integration cards. Wrong card? Edit the paragraph. The original stays in the developer packet.'}
              </p>

              <div className={`mt-4 rounded-2xl border px-3 py-3 ${isDarkMode ? 'border-white/10 bg-black/25' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDarkMode ? 'text-[#c8b58f]' : 'text-navy-600'}`}>
                    Jewelry templates · prefill only
                  </p>
                  <p className={`text-[10px] ${muted}`}>Not live CRM data · edit after picking</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ONBOARD_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(tpl.id);
                        const body =
                          onboardStep === 0
                            ? tpl.hours
                            : onboardStep === 1
                              ? tpl.integrations
                              : onboardStep === 2
                                ? tpl.voice
                                : tpl.review;
                        setPlainEnglish(body);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-left transition ${
                        selectedTemplateId === tpl.id
                          ? tabActiveClass
                          : isDarkMode
                            ? 'border-white/15 text-white/80 hover:border-[#c8b58f]/50'
                            : 'border-slate-200 text-navy-700 hover:border-[#c8b58f]'
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-[0.14em]">{tpl.label}</span>
                      <span className={`block text-[9px] mt-0.5 ${muted}`}>{tpl.blurb}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(null);
                      setPlainEnglish('');
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] ${
                      isDarkMode ? 'border-white/15 text-white/60' : 'border-slate-200 text-navy-500'
                    }`}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <textarea
                value={plainEnglish}
                onChange={(event) => {
                  setPlainEnglish(event.target.value);
                  setSelectedTemplateId(null);
                }}
                rows={8}
                placeholder="Write in plain English, or pick a jewelry template above to prefill this step…"
                className={`mt-4 w-full rounded-2xl border px-4 py-3 text-[14px] leading-relaxed outline-none ${
                  isDarkMode ? 'border-white/10 bg-black/40 text-[#f4efe4] placeholder:text-white/30' : 'border-slate-200 bg-white text-navy-900 placeholder:text-navy-300'
                }`}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {ONBOARD_STEPS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setOnboardStep(index);
                      if (selectedTemplateId) {
                        const tpl = ONBOARD_TEMPLATES.find((t) => t.id === selectedTemplateId);
                        if (tpl) {
                          const body =
                            index === 0
                              ? tpl.hours
                              : index === 1
                                ? tpl.integrations
                                : index === 2
                                  ? tpl.voice
                                  : tpl.review;
                          setPlainEnglish(body);
                        }
                      }
                    }}
                    className={`rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] ${
                      onboardStep === index ? tabActiveClass : `border ${isDarkMode ? 'border-white/15 text-white/70' : 'border-slate-200 text-navy-600'}`
                    }`}
                  >
                    {index + 1} {label}
                  </button>
                ))}
              </div>
            </section>
            <section className={panelClass}>
              <p className="fx-kicker">We heard · preview only, nothing is saved or sent</p>
              <div className="mt-3 space-y-2">
                {heard.map((card) => (
                  <div key={card.title} className={`rounded-2xl border px-3 py-2.5 ${isDarkMode ? 'border-white/10 bg-black/30' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-[13px] ${ink}`}>{card.title}</p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.12em] ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{card.state}</p>
                  </div>
                ))}
              </div>
              <p className={`mt-4 text-[12px] leading-relaxed ${muted}`}>
                Wrong card? Edit the paragraph. The original stays in the developer packet.
              </p>
            </section>
          </div>
        )}

        {activeTab === 'handover' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="fx-kicker">{signed ? 'Signed client · handover gate' : 'Unsigned · preview only'}</p>
                <h2 className="fx-display mt-2 text-2xl md:text-3xl">{signed ? `Ready for build — ${businessName}` : 'Handover locked until sign'}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSigned((value) => !value)}
                className="fx-btn fx-btn-ghost text-[10px]"
              >
                {signed ? 'Mark unsigned' : 'Mark signed'}
              </button>
            </div>
            {!signed ? (
              <p className={`max-w-xl text-[13px] ${muted}`}>
                Engineering does not provision from a Slack thread. Sign the client, then this packet becomes a work order.
              </p>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <Fact label="Answer" body={`Front desk line · display CID ${businessName}`} isDarkMode={isDarkMode} />
                  <Fact label="Write targets" body="Google Calendar · CRM contacts · inventory holds" isDarkMode={isDarkMode} />
                  <Fact label="Escalate" body="Owner after hours if > $10k · design for custom · never legal on the line" isDarkMode={isDarkMode} />
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <section className={panelClass}>
                    <p className="fx-kicker">Engineering checklist · sample, not your account</p>
                    <ul className="mt-3 space-y-2">
                      {HANDOVER_ITEMS.map((item) => (
                        <li key={item.id} className={`text-[13px] ${ink}`}>
                          <span className={item.ready ? 'text-emerald-400' : isDarkMode ? 'text-[#e8d5a8]' : 'text-amber-700'}>
                            {item.ready ? '☑' : '☐'}
                          </span>{' '}
                          {item.label}
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className={panelClass}>
                    <p className="fx-kicker">Do-not-do (client words)</p>
                    <p className={`mt-3 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-navy-800'}`}>
                      {plainEnglish}
                    </p>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'studio' && (
          <div className="mt-6 space-y-3">
            <p className={`text-[12px] ${muted}`}>
              Showroom merchandising only. The voice agent remains the SOP — this never replaces a live inventory lookup.
            </p>
            {ringBuilder ? (
              <LazyRingBuilderSection config={ringBuilder} isDarkMode={isDarkMode} compact businessName={businessName} />
            ) : (
              <p className={muted}>Ring studio is off for this payload (`ringBuilder.enabled: false`).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function parsePlainEnglish(text: string) {
  const cards = [
    { title: 'Phone · front desk', state: 'Mapped · number still needed', hit: /iphone|phone|desk|line/i },
    { title: 'Calendar · bridal', state: 'Mapped · invite owner', hit: /calendar|jane|book/i },
    { title: 'Inventory · Nivoda', state: 'Mapped · token at handover', hit: /nivoda|stone|inventory/i },
    { title: 'After-hours · SMS + escalate', state: 'Rule drafted', hit: /after|6|sms|text|10k|owner/i },
    { title: 'WhatsApp', state: 'Scoped if mentioned', hit: /whatsapp|miami/i },
    { title: 'Website · storefront', state: 'Noted', hit: /shopify|website|storefront/i },
  ];
  const matched = cards.filter((card) => card.hit.test(text));
  return matched.length ? matched : [{ title: 'Needs a first paragraph', state: 'Waiting', hit: /./ }];
}

const Kpi: React.FC<{ label: string; value: string; isDarkMode: boolean }> = ({ label, value, isDarkMode }) => (
  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
    <p className={`text-[10px] uppercase tracking-[0.2em] ${isDarkMode ? 'text-white/55' : 'text-navy-500'}`}>{label}</p>
    <p className={`mt-1 text-xl font-medium tracking-tight ${isDarkMode ? 'text-[#c8b58f]' : 'text-navy-900'}`}>{value}</p>
  </div>
);

const Fact: React.FC<{ label: string; body: string; isDarkMode: boolean }> = ({ label, body, isDarkMode }) => (
  <div className={`rounded-2xl border px-4 py-3 ${isDarkMode ? 'border-white/10 bg-white/[0.04]' : 'border-slate-200 bg-white'}`}>
    <p className="fx-kicker">{label}</p>
    <p className={`mt-2 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/80' : 'text-navy-800'}`}>{body}</p>
  </div>
);

const LogRow: React.FC<{
  title: string;
  meta: string;
  status: string;
  selected: boolean;
  isDarkMode: boolean;
  onClick: () => void;
}> = ({ title, meta, status, selected, isDarkMode, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full rounded-2xl border px-3 py-2.5 text-left ${
      selected
        ? isDarkMode
          ? 'border-amber-300/35 bg-amber-100/5'
          : 'border-navy-400 bg-navy-50'
        : isDarkMode
          ? 'border-white/10 bg-black/40'
          : 'border-slate-200 bg-slate-50'
    }`}
  >
    <p className={`text-[13px] font-medium ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>{title}</p>
    <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-white/55' : 'text-navy-500'}`}>
      {meta} · <span className={statusTone(status, isDarkMode)}>{status}</span>
    </p>
  </button>
);
