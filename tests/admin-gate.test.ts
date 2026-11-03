import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const read = (f: string) => fs.readFileSync(f, 'utf8');

describe('P0.4 admin gate + sample data', () => {
  const app = read('App.tsx');
  it('dead PhoneTester is gone', () => {
    expect(fs.existsSync('components/PhoneTester.tsx')).toBe(false);
    expect(app).not.toMatch(/PhoneTester/);
  });
  it('admin is only reachable behind VITE_ENABLE_ADMIN=1 (default off)', () => {
    expect(app).toMatch(/ADMIN_ENABLED\s*=\s*import\.meta\.env\.VITE_ENABLE_ADMIN\s*===\s*'1'/);
    expect(app).toMatch(/planHashRoute\(window\.location\.hash,\s*ADMIN_ENABLED\)/);
    expect(app).not.toMatch(/setCurrentView\(AppView\.DASHBOARD\)/);
    expect(app).not.toMatch(/^import .*AdminDashboard/m); // lazy only, so the chunk is dropped from a default build
    expect(read('.env.example')).toMatch(/^VITE_ENABLE_ADMIN=\s*$/m);
  });
  it('admin screen carries an internal-preview / sample-data banner', () => {
    expect(read('components/AdminDashboard.tsx')).toMatch(/data-testid="admin-sample-banner"/);
  });
  it('ops portal has no timers inventing leads, revenue or call volume', () => {
    const crm = read('components/CRMView.tsx');
    expect(crm).not.toMatch(/setRevenueSaved|setAppointmentsBooked|setLogEntries|setChannelLoad|pushLead/);
    expect(crm).toMatch(/\(sample\)/);
    expect(crm).toMatch(/SAMPLE DATA/);
  });
});
