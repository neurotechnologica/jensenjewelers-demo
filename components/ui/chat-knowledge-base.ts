/**
 * Hardcoded knowledge base for Melissa (Fourcee demo chatbot).
 * Used when Gemini API key is not set or the API fails.
 */
export interface KnowledgeEntry {
  keywords: string[];
  answer: string;
}

export const CHAT_KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: ['price', 'pricing', 'cost', 'how much', 'fee', 'monthly', 'setup', 'investment', 'tier', 'package', 'plan'],
    answer: "Fourcee has four plans - **Starter** ($497/mo or $4,764/year), **Pro** ($997/mo or $9,564/year), **Enterprise** ($1,997/mo or $19,164/year), and **Diamond** ($3,499/mo or $33,588/year). **The one-time setup fee is waived only when you pay annually.** On monthly billing, setup applies (tiered by plan - see checkout). Starter includes 500 minutes, basic voice, WhatsApp booking, and a website chatbot. Pro adds 2,000 minutes, voice cloning, upsell scripts, all-inboxes chatbot, and image generation. Enterprise adds unlimited minutes, up to 5 stores, CRM and sales reports, Nivoda, and a dedicated manager. Diamond adds unlimited stores, custom APIs, quarterly strategy calls, 24/7 priority support, and co-branded marketing assets. Choose monthly vs annual in checkout to see your exact total.",
  },
  {
    keywords: ['nivoda', 'inventory', 'diamond', 'stock', 'live data', 'availability'],
    answer: "Fourcee integrates directly with **Nivoda** so your AI reads the same inventory your team sees. Every search, estimate, and availability check is backed by live Nivoda data - the AI never offers stones that have left the pipeline. We can translate vague requests (e.g. 'oval, lab-grown, under 3 carats') into structured Nivoda queries and log searches against contacts in your CRM. The integration is built to sit on top of your existing Nivoda workflows, not replace them.",
  },
  {
    keywords: ['after hours', 'after-hours', 'night', 'weekend', '24/7', '24/7', 'off hours', 'closed'],
    answer: "Fourcee runs **24/7** so callers get a consistent experience whether they ring at 2 PM or 2 AM. After-hours and overflow calls are handled by the AI so you don't lose leads when the showroom is closed. You control when it answers and when to route straight to a human; many showrooms use it for after-hours and overflow while keeping staff for peak and VIP calls.",
  },
  {
    keywords: ['integration', 'integrations', 'crm', 'hubspot', 'salesforce', 'calendar', 'calendly', 'sync'],
    answer: "Fourcee integrates with **CRM** (HubSpot, Salesforce, Zoho, Pipedrive, GoHighLevel), **calendars** (Google Calendar, Calendly, Outlook), **e‑commerce** (Shopify, WooCommerce), and **jewelry-specific** tools like Nivoda and Jewel360. We handle the technical build and sync logic; you provide API access or credentials. Call summaries and lead data sync to your CRM so you have full visibility.",
  },
  {
    keywords: ['voice', 'voice cloning', 'accent', 'sound', 'human', 'real'],
    answer: "Voice and phrasing are part of onboarding. We can **voice-clone** a key team member or choose a premium voice, then iterate until it feels like your showroom. Revisions are included in the setup phase. Pro and Enterprise tiers include voice cloning and custom accents so the AI sounds on-brand.",
  },
  {
    keywords: ['replace', 'receptionist', 'staff', 'team', 'human', 'job'],
    answer: "Fourcee is designed to **augment** your team, not replace it. It handles after-hours, overflow, and repetitive questions so your staff can focus on design consults, VIPs, and in-person selling. You control when the AI answers and when calls go straight to a human. Most showrooms see staff time reclaimed rather than roles eliminated.",
  },
  {
    keywords: ['roi', 'return', 'investment', 'worth it', 'pay for itself', 'value'],
    answer: "Many showrooms see **ROI within 90 days**. With setup fees waived on current plans, payback is driven by recovered calls and staff time. We offer an ROI calculator on the site; you can also book a demo to discuss your call volume and typical deal sizes.",
  },
  {
    keywords: ['demo', 'book', 'schedule', 'meeting', 'talk', 'speak to someone'],
    answer: "You can **book a demo** or get a callback using the tools on this site - use the calendar widget or the 'Get Fourcee' / 'Test Fourcee' options. We’ll walk you through how Fourcee would handle your callers, integrations, and after-hours coverage and answer any questions.",
  },
  {
    keywords: ['jeweler', 'jewelry', 'jewellery', 'showroom', 'luxury', 'high-end'],
    answer: "Fourcee is built **specifically for high-end jewelers**. We understand the need for a white-glove experience, safeguard against misrepresenting high-value items, and integrate with jewelry workflows (e.g. Nivoda, repair tracking, custom orders). The tone and scripts are tailored so the AI feels like part of your showroom.",
  },
  {
    keywords: ['safe', 'safeguard', 'escalat', 'vip', 'misunderstand', 'wrong'],
    answer: "We bias everything toward **fail-safe**: strict guardrails, human handoff paths, and clear escalation rules for high-ticket intents. During the onboarding workshop we rehearse VIP and edge-case scenarios until you're comfortable. You can override or add custom escalation triggers so high-value clients are never left to an AI misunderstanding.",
  },
  {
    keywords: ['what is fourcee', 'who are you', 'what do you do', 'tell me about'],
    answer: "**Fourcee** is an AI voice agent for jewelers. It answers calls 24/7, handles bookings, estimates, and availability checks using live data (e.g. Nivoda), and syncs with your CRM and calendars. Think of it as an AI receptionist that speaks in your brand’s voice and fits into your existing tools. I'm Melissa - here to answer questions about how Fourcee would work for your showroom.",
  },
  {
    keywords: ['hello', 'hi', 'hey', 'start', 'help'],
    answer: "Hi! I'm **Melissa**, Fourcee's demo assistant. You can ask me about pricing, Nivoda integration, after-hours coverage, voice cloning, ROI, or how Fourcee fits into your showroom. What would you like to know?",
  },
];

const DEFAULT_RESPONSE =
  "I'm Melissa, Fourcee's demo assistant. I can answer questions about **pricing and tiers**, **Nivoda and inventory**, **after-hours coverage**, **integrations** (CRM, calendars), **voice cloning**, **ROI**, or **booking a demo**. Try asking something like: 'What does the Pro tier include?' or 'How does Nivoda integration work?'";

/**
 * Normalize user input for matching (lowercase, trim, collapse spaces).
 */
function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Score how well the query matches an entry (count of keyword matches).
 */
function scoreEntry(query: string, entry: KnowledgeEntry): number {
  const words = normalizeQuery(query).split(/\s+/);
  let score = 0;
  for (const keyword of entry.keywords) {
    const kw = keyword.toLowerCase();
    if (query.includes(kw)) score += 2;
    if (words.some((w) => w.length > 2 && kw.includes(w))) score += 1;
  }
  return score;
}

/**
 * Get a fallback response from the knowledge base, or the default.
 */
export function getFallbackResponse(userMessage: string): string {
  const query = normalizeQuery(userMessage);
  if (!query) return DEFAULT_RESPONSE;

  let best = { score: 0, answer: DEFAULT_RESPONSE };
  for (const entry of CHAT_KNOWLEDGE_BASE) {
    const score = scoreEntry(query, entry);
    if (score > best.score) best = { score, answer: entry.answer };
  }
  return best.answer;
}

/**
 * Convert markdown-style **bold** to a simple format we can render (e.g. <strong>).
 */
export function formatChatText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');
}
