/**
 * What is real today vs. not yet, shown on the checkout. Source: the onboarding audit (2026-10-03) - keep this list honest and update it
 * whenever a capability actually ships. `status`: live = works today; setup = done for you by our team during onboarding (not self-serve,
 * not automatic); soon = not available yet.
 */
export type CapStatus = 'live' | 'setup' | 'soon';
export interface Capability { id: string; label: string; status: CapStatus; note?: string }

export const CAPABILITIES: Capability[] = [
  { id: 'audit', label: 'Free audit of your store’s missed-call cost', status: 'live' },
  { id: 'demo', label: 'Demo callback: the receptionist rings your phone so you can hear it', status: 'live', note: 'one call per request, English' },
  { id: 'setup', label: 'Done-for-you setup by our team: hours, FAQs, location, escalation rules', status: 'setup', note: 'we do it with you; live within days of payment and details' },
  { id: 'number', label: 'Phone number: we arrange forwarding from your existing line', status: 'setup', note: 'new SA numbers can take longer (provider paperwork)' },
  { id: 'invoice', label: 'Invoice and onboarding call booked by us after you request it', status: 'live', note: 'invoiced by hand; quoted in ZAR for South African stores' },
  { id: 'selfserve', label: 'Self-serve sign-up, instant go-live, online card payment', status: 'soon' },
  { id: 'crm', label: 'Automatic CRM and calendar sync', status: 'soon', note: 'connected case by case during setup' },
  { id: 'portal', label: 'Live call logs, recordings and analytics in your portal', status: 'soon', note: 'the portal today is a demo preview' },
  { id: 'langs', label: 'Afrikaans and other South African languages', status: 'soon', note: 'English first' },
];
export const byStatus = (s: CapStatus) => CAPABILITIES.filter((c) => c.status === s);
