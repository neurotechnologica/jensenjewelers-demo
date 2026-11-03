import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GATE_RANGE, parseGatePrefix, withoutReport } from '../lib/audit-gate-brief';
import type { AuditData } from '../types/audit';

const file = readFileSync('public/content.json', 'utf8');
const end = Number(GATE_RANGE.slice(GATE_RANGE.indexOf('-') + 1));
const prefix = file.slice(0, end + 1);

describe('audit gate prefix', () => {
  it('reads the injection slots from the byte range and not the report', () => {
    expect(prefix).not.toMatch(/revenueModel|Great service|Recommended Recovery/);
    const brief = parseGatePrefix(prefix);
    expect(brief).toMatchObject({
      businessName: 'PLACEHOLDER Business',
      location: 'City, State',
      preparedForLabel: 'Specially Prepared for',
      currencyCode: 'USD',
    });
    expect(brief?.phoneCountryDefault).toBeUndefined();
  });

  it('returns null until both name and location are present', () => {
    expect(parseGatePrefix('{"business":{"name":"A"}}')).toBeNull();
  });

  it('strips report sections from the object kept on the long page', () => {
    const data = JSON.parse(file) as AuditData;
    const pub = withoutReport(data);
    expect(pub.business.name).toBe('PLACEHOLDER Business');
    expect(pub.ringBuilder?.enabled).toBe(true);
    expect(pub.revenueModel).toBeUndefined();
    expect(pub.callModel).toBeUndefined();
    expect(pub.reviews).toBeUndefined();
    expect(pub.recoveryPlan).toBeUndefined();
  });
});
