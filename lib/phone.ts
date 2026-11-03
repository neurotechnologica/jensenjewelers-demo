/**
 * Browser-side phone normalisation for the demo call. MUST behave exactly like server/lead-api/lib/phone.mjs (the server is the authority;
 * tests/fixtures/phone-vectors.json is run against both). South Africa first: 0821234567 -> +27821234567.
 */
export const DEFAULT_COUNTRIES = ['+1', '+44', '+27', '+61', '+91', '+33', '+49', '+251', '+971', '+81'];
const NSN: Record<string, [number, number]> = { '+1': [10, 10], '+44': [9, 10], '+27': [9, 9], '+61': [9, 9], '+91': [10, 10], '+33': [9, 9], '+49': [7, 11], '+251': [9, 9], '+971': [8, 9], '+81': [9, 10] };

export type PhoneResult = { ok: true; e164: string; country: string; nsn: string } | { ok: false; reason: string };
const fail = (reason: string): PhoneResult => ({ ok: false, reason });

export function normalizePhone(input: string, opts: { defaultCountry?: string; allowed?: string[] } = {}): PhoneResult {
  const defaultCountry = opts.defaultCountry ?? '+27';
  const allowed = opts.allowed ?? DEFAULT_COUNTRIES;
  if (typeof input !== 'string' || !input.trim()) return fail('Please enter a phone number');
  const s = input.trim();
  if (!/^[+\d(][\d\s().\-]*$/.test(s)) return fail('Phone number can only contain digits, spaces and + ( ) -');
  let digits = s.replace(/\D/g, '');
  let intl = s.startsWith('+');
  if (!intl && digits.startsWith('00')) { digits = digits.slice(2); intl = true; }
  let cc: string | undefined;
  let nsn: string;
  if (intl) {
    cc = Object.keys(NSN).sort((a, b) => b.length - a.length).find((c) => digits.startsWith(c.slice(1)));
    if (!cc) return fail('That country code is not supported for demo calls');
    nsn = digits.slice(cc.length - 1);
    if (cc !== '+1' && nsn.startsWith('0')) nsn = nsn.slice(1);
  } else {
    cc = defaultCountry;
    if (!NSN[cc]) return fail('Unsupported country');
    if (cc === '+27' && digits.length === 11 && digits.startsWith('27')) nsn = digits.slice(2);
    else if (cc === '+1' && digits.length === 11 && digits.startsWith('1')) nsn = digits.slice(1);
    else if (cc !== '+1' && digits.startsWith('0')) nsn = digits.slice(1);
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

export function numberPolicy(cc: string, nsn: string): string {
  if (cc === '+27') {
    if (!/^[1-8]/.test(nsn)) return 'That South African number cannot be called';
    if (/^(80|85|86|87)/.test(nsn)) return 'Freephone, shared-cost and premium numbers cannot be called';
  }
  if (cc === '+1' && (/^(900|976|800|833|844|855|866|877|888)/.test(nsn) || /^[01]/.test(nsn) || /^\d11/.test(nsn))) return 'That number cannot be called';
  if (cc === '+44' && /^(9|8|70|55|56)/.test(nsn)) return 'Premium and non-geographic numbers cannot be called';
  return '';
}
