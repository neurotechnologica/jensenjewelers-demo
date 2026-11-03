// Phone normalisation + policy for the demo-call guard. South Africa first: 0821234567 -> +27821234567.
// Shared test vectors (tests/fixtures/phone-vectors.json) run against this file AND lib/phone.ts so browser and server cannot drift.

/** Countries the demo may call (matches the site's country picker). Override with DEMO_ALLOWED_COUNTRIES="+27,+44". */
export const DEFAULT_COUNTRIES = ['+1', '+44', '+27', '+61', '+91', '+33', '+49', '+251', '+971', '+81'];
// National-significant-number (digits after the country code, without the trunk 0) length range per country code
export const NSN = { '+1': [10, 10], '+44': [9, 10], '+27': [9, 9], '+61': [9, 9], '+91': [10, 10], '+33': [9, 9], '+49': [7, 11], '+251': [9, 9], '+971': [8, 9], '+81': [9, 10] };

const fail = (reason) => ({ ok: false, reason });

/**
 * @param {string} input    what the visitor typed (any common formatting)
 * @param {{defaultCountry?: string, allowed?: string[]}} opts   defaultCountry is the country picker value, e.g. '+27'
 * @returns {{ok:true,e164:string,country:string,nsn:string}|{ok:false,reason:string}}
 */
export function normalizePhone(input, { defaultCountry = '+27', allowed = DEFAULT_COUNTRIES } = {}) {
  if (typeof input !== 'string' || !input.trim()) return fail('Please enter a phone number');
  const s = input.trim();
  if (!/^[+\d(][\d\s().\-]*$/.test(s)) return fail('Phone number can only contain digits, spaces and + ( ) -');
  let digits = s.replace(/\D/g, '');
  let intl = s.startsWith('+');
  if (!intl && digits.startsWith('00')) { digits = digits.slice(2); intl = true; } // 0027 82 ... international call prefix
  let cc, nsn;
  if (intl) {
    cc = Object.keys(NSN).sort((a, b) => b.length - a.length).find((c) => digits.startsWith(c.slice(1)));
    if (!cc) return fail('That country code is not supported for demo calls');
    nsn = digits.slice(cc.length - 1);
    if (cc !== '+1' && nsn.startsWith('0')) nsn = nsn.slice(1); // "+27 (0)82 ..." : trunk 0 left in
  } else {
    cc = defaultCountry;
    if (!NSN[cc]) return fail('Unsupported country');
    if (cc === '+27' && digits.length === 11 && digits.startsWith('27')) nsn = digits.slice(2); // 27821234567 typed without the +
    else if (cc === '+1' && digits.length === 11 && digits.startsWith('1')) nsn = digits.slice(1);
    else if (cc !== '+1' && digits.startsWith('0')) nsn = digits.slice(1); // trunk prefix 0 -> national number (the 0821234567 bug)
    else nsn = digits;
  }
  if (!allowed.includes(cc)) return fail('Demo calls are not available for that country');
  const [min, max] = NSN[cc];
  if (nsn.length < min || nsn.length > max) return fail(cc === '+27' ? 'South African numbers have 9 digits after the 0 (e.g. 082 123 4567)' : 'That phone number looks the wrong length');
  if (/^(\d)\1+$/.test(nsn)) return fail('That does not look like a real phone number');
  const blocked = numberPolicy(cc, nsn);
  if (blocked) return fail(blocked);
  return { ok: true, e164: `${cc}${nsn}`, country: cc, nsn };
}

/** Toll-fraud guard: ordinary subscriber numbers only; no premium, shared-cost or freephone ranges. Returns an error string or ''. */
export function numberPolicy(cc, nsn) {
  if (cc === '+27') {
    if (!/^[1-8]/.test(nsn)) return 'That South African number cannot be called';
    if (/^(80|85|86|87)/.test(nsn)) return 'Freephone, shared-cost and premium numbers cannot be called';
  }
  if (cc === '+1' && (/^(900|976|800|833|844|855|866|877|888)/.test(nsn) || /^[01]/.test(nsn) || /^\d11/.test(nsn))) return 'That number cannot be called';
  if (cc === '+44' && /^(9|8|70|55|56)/.test(nsn)) return 'Premium and non-geographic numbers cannot be called';
  return '';
}

/** First 3 + last 3 characters only, for logs. */
export const maskPhone = (e164) => (e164 ? `${e164.slice(0, 3)}…${e164.slice(-3)}` : '');
