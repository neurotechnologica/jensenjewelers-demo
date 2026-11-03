'use client';

import * as React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { requestDemoCall, turnstileSiteKey } from '@/lib/demo-client';
import { normalizePhone } from '@/lib/phone';
import { Turnstile } from './turnstile';
import { useEscapeClose } from '@/lib/use-escape-close';

const COUNTRIES = [
  { code: '+27', name: 'ZA', flag: '🇿🇦' },
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+61', name: 'AU', flag: '🇦🇺' },
  { code: '+91', name: 'IN', flag: '🇮🇳' },
  { code: '+33', name: 'FR', flag: '🇫🇷' },
  { code: '+49', name: 'DE', flag: '🇩🇪' },
  { code: '+251', name: 'ET', flag: '🇪🇹' },
  { code: '+971', name: 'AE', flag: '🇦🇪' },
  { code: '+81', name: 'JP', flag: '🇯🇵' },
  // { code: '+39', name: 'IT', flag: '🇮🇹' },
];

export interface MiniPhoneProps {
  className?: string;
  isDarkMode?: boolean;
  businessName?: string;
  leadId?: string;
  /** From content.json → liveDemo.phoneCountryDefault (e.g. "+1"). */
  phoneCountryDefault?: string;
  ctaLabel?: string;
  helperCopy?: string;
  onCallCompleted?: () => void;
}

export function MiniPhone({
  className,
  isDarkMode = true,
  businessName = 'PLACEHOLDER Business',
  leadId,
  phoneCountryDefault,
  ctaLabel,
  helperCopy,
  onCallCompleted,
}: MiniPhoneProps) {
  const matchedDefault = COUNTRIES.find((c) => c.code === phoneCountryDefault) ?? COUNTRIES.find((c) => c.code === '+27') ?? COUNTRIES[0];
  const [selectedCountry, setSelectedCountry] = React.useState(matchedDefault);
  const [phone, setPhone] = React.useState('');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  useEscapeClose(dropdownOpen, () => setDropdownOpen(false), 1400);
  const [status, setStatus] = React.useState<'idle' | 'calling' | 'success'>('idle');

  React.useEffect(() => {
    const next = COUNTRIES.find((c) => c.code === phoneCountryDefault);
    if (next) setSelectedCountry(next);
  }, [phoneCountryDefault]);

  const [error, setError] = React.useState<string | null>(null);
  const [trap, setTrap] = React.useState(''); // honeypot (hidden); bots fill it
  const [token, setToken] = React.useState('');
  const [resetKey, setResetKey] = React.useState(0);
  const siteKey = turnstileSiteKey();

  const handleCall = async () => {
    if (!phone.trim() || status === 'calling') return;
    // Validated + normalised in the browser for instant feedback (0821234567 -> +27821234567); the server repeats the checks.
    const check = normalizePhone(phone, { defaultCountry: selectedCountry.code });
    if (check.ok === false) { setError(check.reason); return; }
    setError(null);
    setStatus('calling');
    // Our own guarded endpoint (VITE_DEMO_ENDPOINT, default /api/demo-call). The n8n webhook is never called from the browser.
    const result = await requestDemoCall({ phone, country: selectedCountry.code, leadId, website: trap, turnstileToken: token });
    if (result.ok === true) { setStatus('success'); return; }
    setStatus('idle');
    setError((result as { message: string }).message);
    if (siteKey) { setResetKey((k) => k + 1); } // a Turnstile token is single-use
  };

  React.useEffect(() => {
    if (status === 'success') {
      onCallCompleted?.();
    }
  }, [status, onCallCompleted]);

  const textClass = isDarkMode ? 'text-white' : 'text-[#2e261c]';
  const mutedClass = isDarkMode ? 'text-slate-400' : 'text-[#5f523f]';
  const inputBg = isDarkMode ? 'bg-white/10 border-white/20' : 'bg-[#f7efde]/85 border-[#b7d4bf]';

  return (
    <div
      className={cn(
        'w-full min-w-0 max-w-sm rounded-2xl p-4 sm:p-6 border backdrop-blur-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)]',
        isDarkMode
          ? 'bg-white/5 border-white/20'
          : 'bg-gradient-to-br from-[#b8e2cd]/85 via-[#a6d8bf]/82 to-[#88c7ab]/78 border-[#7fbaa3]/70 shadow-[0_28px_60px_-18px_rgba(95,130,104,0.45)]',
        className
      )}
      role="group"
      aria-label={`${businessName} demo call - enter number and call`}
    >
      {status === 'success' ? (
        <div className="text-center py-4 animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white">
            <Phone className="w-6 h-6" />
          </div>
          <p className={cn('font-bold', textClass)}>Call initiated</p>
          <p className={cn('text-xs mt-1', mutedClass)}>Check your phone</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', isDarkMode ? 'bg-white/10' : 'bg-[#f6ead6]/90')}>
              <Phone className={cn('w-5 h-5', textClass)} />
            </div>
            <div>
              <p className={cn('text-sm font-bold', textClass)}>{ctaLabel || `${businessName} demo`}</p>
              <p className={cn('text-[10px] uppercase tracking-wider', mutedClass)}>{helperCopy || "We'll call you"}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4 min-w-0">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={cn(
                  'h-12 px-3 rounded-lg sm:rounded-xl border flex items-center gap-2 text-base font-bold min-w-[4.5rem]',
                  inputBg,
                  textClass
                )}
                aria-expanded={dropdownOpen}
                aria-haspopup="listbox"
                aria-label="Country code"
              >
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="font-mono">{selectedCountry.code}</span>
              </button>
              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" aria-hidden onClick={() => setDropdownOpen(false)} />
                  <ul
                    role="listbox"
                    className="absolute top-full left-0 mt-1 w-48 max-h-52 overflow-y-auto rounded-xl border shadow-xl z-20 py-1 bg-[#fbf5e7] dark:bg-navy-900 border-[#b7d4bf] dark:border-white/20 animate-in slide-in-from-top-2"
                  >
                    {COUNTRIES.map((c) => (
                      <li key={c.code} role="option">
                        <button
                          type="button"
                          className={cn(
                            'w-full px-3 py-2.5 text-left text-sm font-medium flex items-center gap-2 transition-colors',
                            c.code === selectedCountry.code
                              ? 'bg-navy-100 dark:bg-white/10 text-navy-900 dark:text-white'
                              : 'text-[#4f4330] dark:text-navy-200 hover:bg-[#f1e6cf] dark:hover:bg-white/5'
                          )}
                          onClick={() => {
                            setSelectedCountry(c);
                            setDropdownOpen(false);
                          }}
                        >
                          <span className="text-lg">{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          <span className="text-[10px] font-mono opacity-80">{c.code}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Phone number"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/[^\d+\s()-]/g, '').slice(0, 20)); if (error) setError(null); }}
              className={cn(
                'flex-1 min-w-0 h-12 px-3 sm:px-4 rounded-lg sm:rounded-xl border text-base font-medium placeholder:opacity-60 focus:outline-none focus:ring-2 focus:ring-white/30',
                inputBg,
                textClass
              )}
              aria-label="Phone number"
              aria-invalid={!!error}
              autoComplete="tel-national"
              enterKeyHint="go"
            />
          </div>
          {/* Honeypot: invisible to people and assistive tech */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </div>
          <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} theme={isDarkMode ? 'dark' : 'light'} />
          {error && (
            <p role="alert" data-testid="demo-error" className={cn('mb-3 text-xs font-semibold leading-snug', isDarkMode ? 'text-red-300' : 'text-red-700')}>{error}</p>
          )}

          <button
            type="button"
            disabled={!phone.trim() || status === 'calling' || (!!siteKey && !token)}
            onClick={handleCall}
            className={cn(
              'w-full h-10 sm:h-11 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all disabled:opacity-50',
              isDarkMode
                ? 'bg-green-500 text-white hover:bg-green-600 active:scale-[0.98]'
                : 'bg-gradient-to-r from-[#22a06b] via-[#19a66f] to-[#0d8d60] text-[#f4fff9] hover:brightness-110 active:scale-[0.98] border border-[#0f8c62] shadow-[0_8px_20px_rgba(13,141,96,0.35)]'
            )}
          >
            <Phone className="w-5 h-5" />
            {status === 'calling' ? 'Calling…' : 'Call'}
          </button>
          <p className={cn('mt-1.5 text-[10px] leading-snug', mutedClass)}>
            Optional. By requesting a call you consent to one demo callback to this number for product demonstration.
            We do not sell your number. Recording only if legally permitted and disclosed on the call.
          </p>
        </>
      )}
    </div>
  );
}
