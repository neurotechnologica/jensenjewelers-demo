export type CallStatus =
  | 'live'
  | 'qualified'
  | 'booked'
  | 'held'
  | 'escalated'
  | 'follow_up'
  | 'resolved'
  | 'no_answer'
  | 'blocked';

export type ActionState = 'done' | 'pending' | 'skipped';

export type TranscriptLine = { speaker: string; line: string; at: string };

export type CallAction = {
  id: string;
  label: string;
  state: ActionState;
  detail?: string;
};

export type OpsCall = {
  id: string;
  customerName: string;
  phone: string;
  intent: string;
  status: CallStatus;
  impact: string;
  startedAgo: string;
  transcript: TranscriptLine[];
  actions: CallAction[];
};

export const STATUS_LABEL: Record<CallStatus, string> = {
  live: 'live',
  qualified: 'qualified',
  booked: 'booked',
  held: 'held',
  escalated: 'escalated',
  follow_up: 'follow_up',
  resolved: 'resolved',
  no_answer: 'no_answer',
  blocked: 'blocked',
};

export function buildHistoryTranscript(customerName: string, intent: string, businessName: string): TranscriptLine[] {
  return [
    { speaker: 'Agent', line: `Thank you for calling ${businessName}. This is the concierge line.`, at: '00:01' },
    { speaker: 'Customer', line: `Hi — ${customerName} here. I'm calling about ${intent.toLowerCase()}.`, at: '00:06' },
    { speaker: 'Agent', line: "I've pulled your preferences. I can hold inventory or book a specialist.", at: '00:14' },
    { speaker: 'Customer', line: "Let's book. What's the soonest private appointment?", at: '00:22' },
    { speaker: 'Agent', line: "Tomorrow 11:15 or Thursday 15:00. I'll text both so you can confirm.", at: '00:30' },
    { speaker: 'Customer', line: 'Tomorrow works. Please send the confirmation.', at: '00:38' },
    { speaker: 'Agent', line: `Confirmed at ${businessName} tomorrow 11:15. Calendar invite is on the way.`, at: '00:45' },
  ];
}

export function seedCalls(businessName: string): OpsCall[] {
  return [
    {
      id: 'call-1',
      customerName: 'Amelia Stone',
      phone: '+1 (212) 555-0191',
      intent: 'Oval diamond comparison',
      status: 'live',
      impact: '$$$',
      startedAgo: '01:38',
      transcript: [
        { speaker: 'Agent', line: `Thank you for calling ${businessName}. How may I assist you?`, at: '00:02' },
        { speaker: 'Customer', line: 'I am looking for eye-clean ovals around 2 carats.', at: '00:08' },
        { speaker: 'Agent', line: 'I can compare two certified stones and hold a 2 PM private viewing.', at: '00:14' },
        { speaker: 'Customer', line: 'Can I come in today?', at: '00:28' },
        { speaker: 'Agent', line: 'Yes. 2 PM is open. Shall I lock it?', at: '00:38' },
        { speaker: 'Customer', line: 'Please do.', at: '00:45' },
        { speaker: 'Agent', line: "Locked. You'll get a confirmation text on this number.", at: '00:52' },
      ],
      actions: [
        { id: 'cal', label: 'Calendar write', state: 'done', detail: 'Today 14:00 · private room' },
        { id: 'sms', label: 'SMS confirmation', state: 'done' },
        { id: 'crm', label: 'CRM contact', state: 'done' },
        { id: 'hold', label: 'Inventory hold', state: 'pending', detail: 'Nivoda · 2ct oval pair' },
        { id: 'human', label: 'Human flag', state: 'skipped' },
      ],
    },
    {
      id: 'call-2',
      customerName: 'Noah Patel',
      phone: '+1 (917) 555-0107',
      intent: 'Custom halo redesign',
      status: 'live',
      impact: '$$',
      startedAgo: '00:52',
      transcript: [
        { speaker: 'Agent', line: `${businessName} concierge, how can I help?`, at: '00:01' },
        { speaker: 'Customer', line: 'I want to redesign my engagement ring into a halo.', at: '00:11' },
        { speaker: 'Agent', line: 'I can book you with the custom design specialist this week.', at: '00:19' },
        { speaker: 'Customer', line: 'This week if possible.', at: '00:26' },
        { speaker: 'Agent', line: 'Wednesday 10:00 is open. Shall I lock that?', at: '00:33' },
        { speaker: 'Customer', line: 'Yes, please.', at: '00:40' },
      ],
      actions: [
        { id: 'cal', label: 'Calendar write', state: 'pending', detail: 'Wed 10:00 · design' },
        { id: 'sms', label: 'SMS confirmation', state: 'pending' },
        { id: 'crm', label: 'CRM contact', state: 'done' },
        { id: 'human', label: 'Escalate to design', state: 'done' },
      ],
    },
    {
      id: 'call-3',
      customerName: 'Harper Wellington',
      phone: '+1 (646) 555-0169',
      intent: 'Appointment booking',
      status: 'booked',
      impact: '$',
      startedAgo: 'Resolved',
      transcript: [
        { speaker: 'Agent', line: `Welcome to ${businessName}, how may I assist?`, at: '00:02' },
        { speaker: 'Customer', line: 'I would like to book a viewing for Saturday.', at: '00:06' },
        { speaker: 'Agent', line: 'Confirmed Saturday 11:00. Invite is sent.', at: '00:15' },
      ],
      actions: [
        { id: 'cal', label: 'Calendar write', state: 'done', detail: 'Sat 11:00' },
        { id: 'sms', label: 'SMS confirmation', state: 'done' },
        { id: 'crm', label: 'CRM contact', state: 'done' },
      ],
    },
    {
      id: 'call-4',
      customerName: 'Sophia Vale',
      phone: '+1 (332) 555-0188',
      intent: 'Lab-grown bridal request',
      status: 'follow_up',
      impact: '$$',
      startedAgo: 'Resolved',
      transcript: [
        { speaker: 'Agent', line: `Thank you for calling ${businessName}.`, at: '00:01' },
        { speaker: 'Customer', line: 'I am looking for a lab-grown bridal set under 15k.', at: '00:09' },
        { speaker: 'Agent', line: 'I will shortlist options and send them today.', at: '00:18' },
      ],
      actions: [
        { id: 'crm', label: 'CRM contact', state: 'done' },
        { id: 'follow', label: 'Send shortlist', state: 'pending', detail: 'Owed today 17:00' },
      ],
    },
  ];
}

export const ONBOARD_STEPS = ['Hours', 'Integrations', 'Voice', 'Review'] as const;

export const SOP_CHECKS = [
  'Answered in brand voice',
  'Qualified intent + contact',
  'Acted (book / hold / escalate)',
  'Confirmed next step out loud',
  'Logged status + actions',
  'Did not invent stock or price',
];

export const HANDOVER_ITEMS = [
  { id: 'number', label: 'Provision inbound number + recording consent', ready: true },
  { id: 'calendar', label: 'Calendar scopes (create + busy read)', ready: true },
  { id: 'crm', label: 'CRM field map (name, phone, intent, status)', ready: true },
  { id: 'inventory', label: 'Inventory read + hold window', ready: true },
  { id: 'voice', label: 'Voice clone or approved house voice', ready: false },
  { id: 'qa', label: 'QA call: book, hold, escalate, after-hours SMS', ready: false },
  { id: 'golive', label: 'Go-live with owner on the line', ready: false },
];
