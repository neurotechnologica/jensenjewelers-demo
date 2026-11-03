import { describe, expect, it } from 'vitest';
import vectors from './fixtures/phone-vectors.json';
import { normalizePhone as client } from '../lib/phone';
import { normalizePhone as server } from '../server/lead-api/lib/phone.mjs';

describe.each([['browser lib/phone.ts', client], ['server phone.mjs', server]] as const)('%s', (_n, fn) => {
  it.each(vectors.ok)('normalises %s -> %s', (input, e164) => {
    const r = fn(input, { defaultCountry: vectors.defaultCountry });
    expect(r.ok).toBe(true);
    expect((r as { e164: string }).e164).toBe(e164);
  });
  it.each(vectors.bad)('rejects %j', (input) => {
    const r = fn(input, { defaultCountry: vectors.defaultCountry });
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toBeTruthy();
  });
  it('the audit bug: SA number typed with the leading 0 is never sent as +270...', () => {
    const r = fn('0821234567', { defaultCountry: '+27' });
    expect((r as { e164: string }).e164).not.toMatch(/^\+270/);
  });
  it('respects the allowed-country list', () => {
    expect(fn('+44 7700 900123', { allowed: ['+27'] }).ok).toBe(false);
    expect(fn('0821234567', { allowed: ['+27'] }).ok).toBe(true);
  });
  it('US default: national format and 1-prefix', () => {
    expect((fn('(415) 555-2671', { defaultCountry: '+1' }) as { e164: string }).e164).toBe('+14155552671');
    expect((fn('14155552671', { defaultCountry: '+1' }) as { e164: string }).e164).toBe('+14155552671');
  });
});

describe('client and server agree on a fuzz set', () => {
  it('same verdict + same E.164 for 3000 random inputs', () => {
    let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const alphabet = '0123456789 +()-.abc';
    for (let i = 0; i < 3000; i++) {
      const len = 1 + Math.floor(rnd() * 16);
      let s = ''; for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
      for (const dc of ['+27', '+1', '+44']) expect(client(s, { defaultCountry: dc })).toEqual(server(s, { defaultCountry: dc }));
    }
  });
});
