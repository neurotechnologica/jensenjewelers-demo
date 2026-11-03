import React, { Suspense, lazy, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AppView, BlogPost } from './types';
import { FloatingNav } from './components/FloatingNav';

import logoUrl from './assets/logo.png';
import demoImage from './public/assets/placeholder.gif';
import workflowImage from './assets/workflow5.png';
import nivodaGif from './public/assets/nivoda.gif';
import fcWhite from './public/assets/fcwhite.png';
import fcBlack from './public/assets/fcblack.png';
import { ValueCalculator } from './components/ValueCalculator';
import DisplayCards from './components/ui/display-cards';
import { MiniPhone } from './components/ui/mini-phone';
import {
  PhoneCall,
  ChevronDown,
  X,
  Info,
  House,
  FileSearch,
  CreditCard,
  CalendarDays,
  Gem,
} from 'lucide-react';
const CheckoutFlow = lazy(() => import('./components/CheckoutFlow').then((m) => ({ default: m.CheckoutFlow })));
const AuditPage = lazy(() => import('./components/AuditPage').then((m) => ({ default: m.AuditPage })));
const DottedSurface = lazy(() => import('./components/ui/dotted-surface').then((m) => ({ default: m.DottedSurface })));
const IncomingCallPhone = lazy(() => import('./components/ui/incoming-call-phone').then((m) => ({ default: m.IncomingCallPhone })));
const FloatingAiAssistant = lazy(() => import('./components/ui/glowing-ai-chat-assistant').then((m) => ({ default: m.FloatingAiAssistant })));
// Internal admin preview (mock clients / MRR, no auth). OFF in production builds: it is only compiled in when VITE_ENABLE_ADMIN=1, so the
// default bundle contains neither the route, the hidden button nor the mock data.
const ADMIN_ENABLED = import.meta.env.VITE_ENABLE_ADMIN === '1';
const AdminDashboard = ADMIN_ENABLED
  ? React.lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
  : null;
import { SplashScreen } from './components/SplashScreen';
import { FaqMonochrome } from './components/ui/faq-monochrome.tsx';
import { ArticleCard } from './components/ui/blog-post-card';
import { BLOG_POSTS } from './constants';
import { LazyRingBuilderSection } from './components/LazyRingBuilderSection';
import type { AuditData } from './types/audit';
import { loadAuditContent, PLACEHOLDER_BUSINESS_NAME } from './lib/audit-content';
import { briefFromAudit, loadAuditGateBrief, withoutReport, type AuditGateBrief } from './lib/audit-gate-brief';
import { sealAudit } from './lib/audit-sealed';
import { configuredCalUrl, demoDurationLine, SIDE_DEAL_DEFAULT, snapDeal } from './lib/prospect-fixes';
import { planHashRoute } from './lib/hash-route';
import { landingSectionElementId, pinScrollTarget } from './lib/scroll-section';
import { useEscapeClose } from './lib/use-escape-close';
import { resolveRingBuilder } from './lib/ring-builder';
import { assetUrl } from './lib/asset-url';
import { renderSimpleMarkdown } from './lib/markdown';

/** Mount heavy children only once they intersect the viewport, so three.js stays out of the first paint. */
function WhenNear({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShow(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={className}>{show ? <Suspense fallback={null}>{children}</Suspense> : null}</div>;
}

const INTEGRATIONS_DATA = [
  {
    category: "CRM Platforms",
    popular: ["Salesforce", "HubSpot"],
    others: ["Zoho CRM", "Pipedrive", "GoHighLevel", "monday CRM"],
    description: "For lead creation, customer notes, history pulls, and automated tagging."
  },
  {
    category: "Calendar & Scheduling",
    popular: ["Google Calendar"],
    others: ["Microsoft Outlook", "Office 365", "Apple Calendar"],
    description: "Seamless consultation booking and staff availability sync."
  },
  {
    category: "E-commerce & Orders",
    popular: ["Shopify", "WooCommerce"],
    others: ["BigCommerce", "Squarespace Commerce", "Magento", "Adobe Commerce"],
    description: "Real-time order status, inventory checks, and cross-channel sync."
  },
  {
    category: "Jewelry-Specific ERP/POS",
    popular: ["Nivoda", "Jewel360"],
    others: ["PIRO", "Gem Logic", "Orderry", "GOIS", "CaratIQ", "SalesBinder", "RapNet", "IDEXonline"],
    description: "Deep Nivoda integration for live diamond sourcing, repair tracking, and stock checks via direct API."
  },
  {
    category: "Communication & SMS",
    popular: ["Twilio", "Zapier"],
    others: ["Vonage", "MessageBird", "Sinch", "Plivo", "RingCentral", "Nextiva"],
    description: "Automated follow-ups, confirmations, and reminders across all channels."
  },
  {
    category: "Utilities & Enhancements",
    popular: ["Metal Price APIs", "Google Workspace"],
    others: ["Make (Integromat)", "Microsoft 365", "Gmail", "Outlook Email"],
    description: "Real-time gold/diamond rates and broad ecosystem confirmations."
  }
];

const JOURNEY_STEPS = [
  {
    label: "1. Select package",
    description: "Choose Starter, Premium or Enterprise based on call volume, complexity and integrations. We'll recommend a tier if you're unsure.",
  },
  {
    label: "2. Onboarding workshop",
    description: "90-min session to map scripts, tone, safeguards and escalation rules. We capture your brand voice and edge cases.",
  },
  {
    label: "3. Setup & integrations",
    description: "We wire Nivoda, calendars, telephony and your CRM. You provide access; we handle the technical build and sync logic.",
  },
  {
    label: "4. Testing & hardening",
    description: "You and your team stress-test every scenario before go-live. No caller hears the AI until you sign off.",
  },
  {
    label: "5. Iterate & refine",
    description: "We tune prompts and flows from real transcripts until it feels like your showroom - not a generic bot.",
  },
  {
    label: "6. Go-live & handover",
    description: "We flip the switch together and train your team on controls, overrides and the analytics portal.",
  },
  {
    label: "7. Analytics & CRM portal",
    description: "Call summaries and outcomes in one place. CRM connection is set up with you, store by store.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is this meant to replace my front-desk team?",
    answer:
      "No. Fourcee handles after-hours, overflow and repetitive questions so your team can focus on design consults, VIPs and in-person selling. You control when it answers and when to route straight to a human. Most showrooms see staff time reclaimed, not replaced.",
    meta: "Team",
  },
  {
    question: "What if Fourcee misunderstands a high‑value client?",
    answer:
      "We bias everything toward fail-safe: strict guardrails, human handoff paths and clear escalation rules for high-ticket intents. During testing we rehearse VIP scenarios until you're comfortable. You can always override or add custom escalation triggers.",
    meta: "Safeguards",
  },
  {
    question: "How heavy is the Nivoda / CRM integration lift on our side?",
    answer:
      "We handle the technical build. You provide API access or credentials to Nivoda, calendars and your CRM; we build the flows, sync logic and testing harness. Your team focuses on approvals and edge-case decisions, not middleware or code.",
    meta: "Integrations",
  },
  {
    question: "What if we don’t like the voice or phrasing?",
    answer:
      "Voice, pacing and phrasing are part of onboarding. We can voice-clone a key team member or choose a premium voice, then iterate until it feels like your showroom answering. Revisions are included in the setup phase.",
    meta: "Brand",
  },
  {
    question: "How are calls recorded and where do the analytics live?",
    answer:
      "Every call can be recorded, transcribed and summarised with timestamps. Summaries and stats are reviewed with you in your analytics portal and, where your CRM is supported, connected to it during setup. You own the data.",
    meta: "Data",
  },
  {
    question: "What happens if we feel the ROI isn’t there?",
    answer:
      "On annual billing, the one-time setup fee is waived. On monthly billing, a setup fee applies by tier. After that, you’re on a simple subscription. If performance isn’t where it should be, we iterate with you. If it still doesn’t fit, we'll discuss pausing or stepping down - no lock-in.",
    meta: "ROI",
  },
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isReady, setIsReady] = useState(false);
  const heroPoster = assetUrl('assets/plates/plate_hero_ring.webp');
  const [isDarkMode] = useState(false); // light theme only — dark mode retired
  const [expandedIntegration, setExpandedIntegration] = useState<number | null>(null);
  const [preSelectedPackageId, setPreSelectedPackageId] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [gateBrief, setGateBrief] = useState<AuditGateBrief | null>(null);
  const [auditDataLoading, setAuditDataLoading] = useState(true);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  // Synchronous initial value: exactly ONE Ring Builder (WebGi context) is ever mounted - the desktop hero rail OR the phone/tablet
  // section - never both (the hidden one used to stay mounted, wait 4 s for a zero-size host and then spin up a second, fallback WebGL context).
  const [heroRingDesktop, setHeroRingDesktop] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(min-width: 1024px)').matches ?? false));
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const apply = () => setHeroRingDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const [sideMenuCallsPerMonth, setSideMenuCallsPerMonth] = useState(12);
  const [sideMenuAvgDeal, setSideMenuAvgDeal] = useState(SIDE_DEAL_DEFAULT);
  const dealValue = snapDeal(sideMenuAvgDeal);
  const calUrl = configuredCalUrl();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const businessName = auditData?.business.name ?? gateBrief?.businessName ?? PLACEHOLDER_BUSINESS_NAME;
  const ringBuilder = useMemo(() => resolveRingBuilder(auditData), [auditData]);

  // Direct #/audit reads only the name/city prefix. The rest of content.json is fetched after a sent lead.
  // The long page still loads the file (ring studio + showroom name) but does not keep report sections on the React tree.
  const prospectLoaded = useRef(false);
  const loadProspect = useCallback(() => {
    if (prospectLoaded.current) return;
    prospectLoaded.current = true;
    loadAuditContent()
      .then((data: AuditData) => {
        sealAudit(data);
        setAuditData(withoutReport(data));
        setGateBrief(briefFromAudit(data));
        setAuditDataLoading(false);
      })
      .catch(err => {
        console.error('Failed to load audit data:', err);
        prospectLoaded.current = false;
        setAuditDataLoading(false);
      });
  }, []);

  useEffect(() => {
    const auditFirst = planHashRoute(window.location.hash, ADMIN_ENABLED).view === AppView.LEAD_MAGNET;
    if (auditFirst) {
      let live = true;
      loadAuditGateBrief()
        .then((brief) => { if (live) setGateBrief(brief); })
        .catch((err) => { console.error('Failed to load audit gate:', err); })
        .finally(() => { if (live) setAuditDataLoading(false); });
      return () => { live = false; };
    }
    loadProspect();
  }, [loadProspect]);

  useEffect(() => {
    if (planHashRoute(window.location.hash, ADMIN_ENABLED).view === AppView.LEAD_MAGNET) return;
    loadProspect();
  }, [currentView, loadProspect]);

  useEffect(() => {
    const theme = auditData?.branding?.theme;
    if (!theme) return;
    const root = document.documentElement;
    if (theme.primary) root.style.setProperty('--fourcee-brand-primary', theme.primary);
    if (theme.secondary) root.style.setProperty('--fourcee-brand-secondary', theme.secondary);
    if (theme.accentGold) root.style.setProperty('--fourcee-accent-copper', theme.accentGold);
    if (theme.accentSilver) root.style.setProperty('--fourcee-accent-ice', theme.accentSilver);
  }, [auditData]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'instant' });
    else window.scrollTo(0, 0);
  }, [currentView]);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/png';
    link.href = logoUrl;
  }, []);

  useEscapeClose(isSideMenuOpen, () => setIsSideMenuOpen(false), 1200);

  const navigate = useCallback((view: AppView, post?: BlogPost, packageId?: string) => {
    setCurrentView(view);
    if (post) setSelectedPost(post);
    if (view === AppView.CHECKOUT) {
      setPreSelectedPackageId(packageId ?? null);
      const el = scrollContainerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: 'instant' });
      else window.scrollTo({ top: 0, behavior: 'instant' });
    } else setPreSelectedPackageId(null);
    const nextHash = (() => {
      switch (view) {
        case AppView.LEAD_MAGNET: return '#/audit';
        case AppView.DASHBOARD: return '#/';
        case AppView.CHECKOUT: return '#/checkout';
        case AppView.BLOG: return '#/insights';
        case AppView.BLOG_POST: return post?.slug ? `#/insights/${post.slug}` : '#/insights';
        case AppView.TERMS: return '#/terms';
        case AppView.ADMIN: return '#/admin';
        default: return '#/';
      }
    })();
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash);
    }
  }, []);

  // Checkout and the audit report are full-screen views. Escape returns home, under any real dialog (menu, chat, AR).
  useEscapeClose(currentView === AppView.CHECKOUT, () => navigate(AppView.LANDING), 80);
  useEscapeClose(currentView === AppView.LEAD_MAGNET, () => navigate(AppView.LANDING), 80);

  const scrollLandingSection = (head: string) => {
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    const id = landingSectionElementId(head, wide);
    const container = scrollContainerRef.current;
    if (container && pinScrollTarget(container, id)) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  const applyHashRoute = useCallback(() => {
    const plan = planHashRoute(window.location.hash, ADMIN_ENABLED);
    if (plan.replaceHome && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search || '/');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    if (plan.view === AppView.BLOG_POST && plan.postSlug) {
      const post = BLOG_POSTS.find((bp) => bp.slug === plan.postSlug || bp.id === plan.postSlug);
      if (post) {
        setSelectedPost(post);
        setCurrentView(AppView.BLOG_POST);
        return;
      }
      setCurrentView(AppView.BLOG);
      return;
    }
    setCurrentView(plan.view);
    if (plan.section) window.setTimeout(() => scrollLandingSection(plan.section!), 60);
  }, []);

  // Cold load of ?v=full#/roi fires this effect while the splash is still the only tree, so the first
  // scrollIntoView finds nothing. Retry once the landing sections exist.
  useEffect(() => {
    if (!isReady) return;
    const plan = planHashRoute(window.location.hash, ADMIN_ENABLED);
    if (!plan.section) return;
    let cancelled = false;
    let tries = 0;
    let timer = 0;
    const run = () => {
      if (cancelled) return;
      const wide = window.matchMedia('(min-width: 1024px)').matches;
      const id = landingSectionElementId(plan.section!, wide);
      const container = scrollContainerRef.current;
      // pinScrollTarget keeps correcting after the mobile ring poster swaps for the 112vh track.
      if (container && pinScrollTarget(container, id)) return;
      if (tries++ < 40) timer = window.setTimeout(run, 50);
    };
    timer = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isReady]);

  useEffect(() => {
    applyHashRoute();
    const onRoute = () => applyHashRoute();
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, [applyHashRoute]);

  const goToRingBuilder = useCallback(() => {
    const next = '#/ring';
    if (window.location.hash !== next) window.history.pushState(null, '', next);
    setCurrentView(AppView.LANDING);
    window.setTimeout(() => scrollLandingSection('ring'), 280);
  }, []);

  const toggleDarkMode = () => {}; // dark mode retired
  const sideMenuRecoveredMonthly = Math.round(sideMenuCallsPerMonth * dealValue * 0.22);
  const openCalendarBooking = () => {
    if (!calUrl) return;
    window.open(calUrl, '_blank', 'noopener,noreferrer');
  };


  // ROOT-CAUSE FIX: LandingPage component type must be stable.
  // Previously useMemo([auditData, ringBuilder, ...]) recreated the component
  // function whenever content.json resolved → React unmounted the entire tree
  // (3D canvas, DottedSurface WebGL, FAQ, cards) mid-scroll = flash/reload.
  const landingLiveRef = useRef({
    isDarkMode,
    businessName,
    auditData,
    navigate,
    ringBuilder,
    expandedIntegration,
    setExpandedIntegration,
    heroRingDesktop,
  });
  landingLiveRef.current = {
    isDarkMode,
    businessName,
    auditData,
    navigate,
    ringBuilder,
    expandedIntegration,
    setExpandedIntegration,
    heroRingDesktop,
  };
  const [, landingBump] = useState(0);
  useEffect(() => {
    landingBump((n) => n + 1);
  }, [isDarkMode, businessName, auditData, ringBuilder, expandedIntegration, heroRingDesktop]);


  const LandingPage = useMemo(() => {
    // LANDING_PAGE_STABLE — created once; reads live values via landingLiveRef
    return function LandingPageImpl({ scrollContainerRef }: { scrollContainerRef: React.RefObject<HTMLDivElement | null> }) {
    const {
      isDarkMode,
      businessName,
      auditData,
      navigate,
      ringBuilder,
      expandedIntegration,
      setExpandedIntegration,
      heroRingDesktop,
    } = landingLiveRef.current;
    const [showDemoCallModal, setShowDemoCallModal] = useState(false);
    useEscapeClose(showDemoCallModal, () => setShowDemoCallModal(false), 160);
    const scrollToSectionById = (id: string) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      pinScrollTarget(container, id);
    };

    const pushSection = (section: string) => {
      const next = `#/${section}`;
      if (window.location.hash !== next) window.history.pushState(null, '', next);
    };
    const scrollToRoi = () => { pushSection('roi'); scrollToSectionById('roi-calculator'); };
    const scrollToPricing = () => navigate(AppView.CHECKOUT);
    const goToAudit = () => navigate(AppView.LEAD_MAGNET);
    const scrollToRingStudio = () => {
      const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
      pushSection('ring');
      scrollToSectionById(wide ? 'ring-studio-hero' : 'ring-studio');
    };

    const handleDemoCallCompleted = () => {
      window.setTimeout(() => {
        setShowDemoCallModal(false);
        navigate(AppView.LEAD_MAGNET);
      }, 1700);
    };

    useEffect(() => {
      const boot = document.getElementById('lcp-poster') as HTMLImageElement | null;
      if (!boot) return;
      const drop = () => { boot.remove(); };
      if (boot.complete && boot.naturalWidth > 0) requestAnimationFrame(drop);
      else boot.addEventListener('load', () => requestAnimationFrame(drop), { once: true });
    }, []);

    return (
    <div className="dock-safe-pad pb-32 md:pb-40" style={{ contentVisibility: 'visible' }}>
      {/* Hero: ribbed gold-glow texture + desktop ring-left / copy-right */}
      <section
        id="hero"
        className="fourcee-hero-beige relative min-h-0 overflow-hidden lg:min-h-[100svh]"
      >
        <div
          className="fourcee-hero-beige-veil pointer-events-none absolute inset-0"
          style={{
            opacity: 0.55,
            background:
              `linear-gradient(105deg, rgba(250,245,234,0.22) 0%, rgba(250,245,234,0.12) 42%, rgba(246,239,223,0.16) 72%, rgba(250,245,234,0.2) 100%), radial-gradient(ellipse 70% 60% at 28% 55%, rgba(200,181,143,0.08), transparent 58%)`,
          }}
          aria-hidden
        />
        <div className="fx-grid z-[1]" aria-hidden />
        {/* Phone-sized screens: the lower half of the hero (the "Try Fourcee on your phone" card and its legal text) fades into the page's
            solid beige, so the dark vertical slats of the background texture never sit behind small text. Starts at ~38% of the hero,
            fully solid by ~69%. Keeps the existing background, veil and grid above; md+ is unchanged. */}
        <div className="fourcee-hero-fade pointer-events-none absolute inset-0 z-[2] md:hidden" data-testid="hero-fade" aria-hidden />
        <div className="relative z-10 mx-auto grid min-h-0 w-full max-w-7xl grid-cols-1 content-start items-start gap-4 px-5 pt-8 pb-8 sm:px-8 sm:pt-24 md:px-12 md:items-center lg:min-h-[100svh] lg:grid-cols-2 lg:gap-10 lg:content-center lg:py-20">
          {/* Desktop: Ring Builder inhabiting the left rail */}
          <div
            id="ring-studio-hero"
            className="relative hidden min-h-[560px] w-full lg:block"
          >
            {ringBuilder && heroRingDesktop ? (
              <LazyRingBuilderSection
                config={ringBuilder}
                isDarkMode
                heroEmbed
                businessName={businessName}
              />
            ) : ringBuilder ? (
              <div className="flex min-h-[560px] items-center justify-center rounded-[2rem] border border-white/10 text-[10px] uppercase tracking-[0.22em] text-[#c8b58f]">
                Ring studio
              </div>
            ) : (
              <div
                className="flex h-full min-h-[520px] items-center justify-center rounded-[2rem] border border-[rgba(200,181,143,0.22)] bg-[#050910]/40"
                aria-hidden
              >
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#a8957a]">Showroom loading</p>
              </div>
            )}
          </div>

          {/* Copy / CTAs — full width on mobile, right rail on desktop */}
          <div className="w-full max-w-xl text-left lg:justify-self-end">
            <img
              src={heroPoster}
              alt=""
              width={1280}
              height={720}
              fetchPriority="high"
              decoding="async"
              data-testid="hero-lcp-poster"
              className="mb-0 h-auto max-h-[7.5rem] w-[min(88vw,380px)] aspect-video rounded-2xl object-cover object-[center_40%] shadow-[0_18px_40px_rgba(12,11,9,0.18)] lg:hidden"
            />
            <div className="fx-chip mb-1 sm:mb-5">
              <span className="fx-dot" />
              Concierge standby · audit compiled
            </div>
            <h1
              className="fx-display text-[22px] leading-[1.05] text-[#0c0b09] sm:text-[30px] md:text-4xl lg:text-5xl"
            >
              <span className="block">The gold standard</span>
              <span className="block">of voice AI</span>
            </h1>
            <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#3a342b] sm:mt-4 sm:text-[11px] sm:tracking-[0.22em]">
              Tailored exclusively for high-end jewelers
            </p>
            <div className="liquid-glass mt-2 max-w-[440px] rounded-2xl px-5 py-2.5 sm:mt-6 sm:py-4">
              <p className="fx-kicker">Prepared for</p>
              <p className="mt-1.5 text-sm sm:text-base text-[#0c0b09] font-medium tracking-wide">{businessName}</p>
              <p className="mt-1.5 text-[12px] sm:text-[13px] leading-relaxed text-[#3a342b]">
                One recovered client can cover months of platform cost.
              </p>
            </div>
            <div className="hero-cta mt-2 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
              <button type="button" onClick={scrollToRingStudio} className="fx-btn fx-btn-primary">
                Try the Ring Builder
              </button>
              <button type="button" onClick={goToAudit} className="fx-btn fx-btn-ghost">
                Access my custom audit
              </button>
              <button type="button" onClick={scrollToRoi} className="fx-btn fx-btn-ghost">
                Calculate ROI
              </button>
            </div>
            {/* Raised on mobile so phone demo is visible without deep scroll */}
            <div className="mt-2 max-w-sm sm:mt-6 opacity-95 sm:translate-y-0">
              <MiniPhone
                className="pb-2"
                isDarkMode={false}
                businessName={businessName}
                leadId={auditData?.lead_id}
                phoneCountryDefault={auditData?.liveDemo.phoneCountryDefault}
                ctaLabel={auditData?.liveDemo.ctaLabel}
                helperCopy={demoDurationLine(auditData?.liveDemo.helperCopy, auditData?.liveDemo.demoDurationHint)}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile / tablet: keep cinematic scroll Ring Builder journey */}
      {ringBuilder && !heroRingDesktop && (
        <section
          id="ring-studio"
          className="fourcee-ribbed-wash px-0 pt-8 pb-16 sm:px-6 md:pt-12 md:pb-24 lg:hidden"
        >
          <div className="mx-auto mb-4 w-full max-w-6xl px-4 text-center sm:px-1 sm:text-left">
            <p className="fx-kicker text-[#c8b58f]">Lead magnet · private showroom</p>
            <h2 className="fx-display mt-2 text-[1.55rem] leading-[1.02] text-[#f4efe4] sm:text-2xl md:text-3xl">
              Ring Builder
            </h2>
            <p className="mt-2 max-w-xl text-[12px] sm:text-sm leading-relaxed text-[#ddd4c6]">
              One short scroll docks the ring into the studio — then customize metal and stone.
            </p>
          </div>
          <div className="mx-auto w-full max-w-6xl px-0 sm:px-1">
            <LazyRingBuilderSection config={ringBuilder} isDarkMode={false} businessName={businessName} />
          </div>
        </section>
      )}

      {/* Demo Video Section - now directly after hero; 9:16 portrait on mobile */}
      <section id="demo" className="flex flex-col justify-center py-16 md:py-24 px-4 sm:px-6 bg-transparent relative scroll-mt-24">
        <div className="max-w-6xl mx-auto flex flex-col items-center w-full min-w-0">
          <h2 id="demo-heading" className="mb-6 scroll-mt-24 overflow-visible px-4 text-center text-xl font-bold serif text-navy-900 sm:text-2xl md:mb-10 md:text-3xl">
            Experience the Demo
          </h2>
          <button
            type="button"
            onClick={() => setShowDemoCallModal(true)}
            className="mb-6 h-12 md:h-14 px-5 md:px-8 bg-navy-900/90 dark:bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-[#c8b58f]/50 text-white dark:text-navy-950 text-[10px] md:text-xs uppercase tracking-[0.22em] font-bold shadow-xl"
          >
            Call me
          </button>
          <div
            className="relative w-full max-w-[280px] aspect-[9/16] md:max-w-4xl md:aspect-video rounded-2xl md:rounded-[3rem] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] group origin-center"
          >
             <img src={demoImage} alt="Demo" loading="lazy" decoding="async" className="w-full h-full object-cover brightness-75 group-hover:scale-105 transition-transform duration-1000" />
             <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 md:p-0">
                <div className="mt-4 md:mt-8 text-center max-w-md px-2 md:px-6">
                  <p className="text-sm md:text-xl serif italic leading-relaxed">"Fourcee didn't just replace our receptionist; it enhanced the entire client experience. Our ROI was instant."</p>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#faf5ea] [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] md:mt-4">— Julianna Rossi, Rossi Haute Joaillerie</p>
                </div>
             </div>
          </div>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={scrollToPricing}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.25em] shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              <span>Select a package</span>
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 md:h-72">
          <WhenNear className="h-full w-full">
            <DottedSurface
              isDarkMode={isDarkMode}
              className="h-full w-full opacity-75 [mask-image:linear-gradient(to_top,black,transparent)]"
            />
          </WhenNear>
        </div>
      </section>
      {showDemoCallModal && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Demo callback">
          <button
            type="button"
            className="absolute inset-0 bg-[#0c0b09]/80 backdrop-blur-md"
            onClick={() => setShowDemoCallModal(false)}
            aria-label="Close demo call popup"
          />
          <div className="relative w-full max-w-md rounded-3xl border border-[#d9c39a] bg-[#faf5ea] p-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.26em] text-navy-600 dark:text-navy-300">Demo callback</p>
            <h3 className="mt-2 text-xl serif text-navy-900 dark:text-white">Get your live callback now</h3>
            <p className="mt-2 text-sm text-navy-700 dark:text-navy-300">
              Enter your number with country code. After the demo call, we will unlock your custom audit view.
            </p>
            <div className="mt-4">
              <MiniPhone
                isDarkMode={isDarkMode}
                businessName={businessName}
                leadId={auditData?.lead_id}
                phoneCountryDefault={auditData?.liveDemo.phoneCountryDefault}
                ctaLabel={auditData?.liveDemo.ctaLabel}
                helperCopy={demoDurationLine(auditData?.liveDemo.helperCopy, auditData?.liveDemo.demoDurationHint)}
                onCallCompleted={handleDemoCallCompleted}
              />
            </div>
          </div>
        </div>
      )}

      {/* Value Calculator Section - before ROI messaging; its own snap after demo */}
      <section id="roi-calculator" className="flex flex-col justify-center px-4 sm:px-6 py-16 md:py-24 bg-transparent scroll-mt-24">
        <div className="w-full max-w-4xl mx-auto">
          <ValueCalculator isDarkMode={isDarkMode} businessName={businessName} />
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(AppView.CHECKOUT)}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] shadow-lg hover:scale-105 transition-all"
            >
              Start recovering revenue now
            </button>
          </div>
        </div>
      </section>

      {/* ROI follow-up: both columns and a full-width strip, so the band under the calculator is not an empty field */}
      <section className="px-4 pb-6 pt-2 sm:px-6 md:pb-10">
        <div className="mx-auto grid w-full max-w-6xl items-stretch gap-4 rounded-[1.75rem] border border-[#d9c39a]/70 bg-white/70 p-5 sm:p-6 lg:grid-cols-2 lg:gap-8">
          <div className="flex flex-col justify-center space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-navy-400 dark:text-navy-300">
              See if the numbers make sense
            </p>
            <h2 className="text-lg font-bold serif tracking-tight text-navy-900 sm:text-xl md:text-2xl">
              Is Fourcee actually worth it for your showroom?
            </h2>
            <p className="max-w-xl text-sm text-navy-600 dark:text-navy-300 sm:text-base">
              The calculator above uses your averages. The signals beside it are what those answered calls turn into once the line is covered.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="glass-card rounded-[1.75rem] border border-navy-50 p-6 shadow-xl dark:border-navy-800 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-4 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live Performance Signals
              </p>
              <div className="space-y-4">
                {[
                  "Qualified callers passed to your team with a summary",
                  "24/7 coverage while your team sleeps",
                  "Call summaries reviewed with you (portal preview is demo data today)",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-navy-900 dark:bg-white rounded-full" />
                    <span className="font-bold text-base md:text-lg text-navy-900 dark:text-navy-50 tracking-tight">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => navigate(AppView.CHECKOUT)}
              className="w-full py-5 bg-navy-900 dark:bg-white dark:text-navy-950 text-white rounded-full font-bold text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
            >
              Configure your solution →
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
            {[
              ['Answered after hours', 'The line is covered when the showroom is dark.'],
              ['A summary your team can use', 'Each recovered caller arrives with the ask already written down.'],
              ['One number, still yours', 'Callers reach the same shop. Fourcee picks up the ones you miss.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-[#d9c39a]/80 bg-[#faf5ea] p-4">
                <p className="text-sm font-semibold text-[#1a1714]">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#3a342b]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Step - moved below calculator: blue + grid faded at top and bottom */}
      <section className="fourcee-ribbed-wash min-h-screen flex flex-col justify-center py-32 px-6 text-white relative overflow-x-hidden overflow-y-visible border-y border-white/5">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(5,5,4,0.55) 0%, rgba(5,5,4,0.35) 40%, rgba(5,5,4,0.7) 100%), linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: 'auto, 40px 40px, 40px 40px',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 md:h-72">
          <WhenNear className="h-full w-full">
            <DottedSurface
              isDarkMode
              className="h-full w-full opacity-80 [mask-image:linear-gradient(to_top,black,transparent)]"
            />
          </WhenNear>
        </div>
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center relative z-10">
          <div className="space-y-10">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold serif leading-tight text-white">
              Silence is <br/><span className="italic text-silver-200">Expensive</span>
            </h2>
            <p className="text-base sm:text-lg text-silver-100 font-light leading-relaxed max-w-lg">
              Every missed call after 6 PM is a client wandering into your competitor's showroom. Fourcee captures the revenue you're currently leaving on the table.
            </p>
            <div className="flex gap-12">
              <div>
                <p className="text-3xl font-bold mb-1 serif">$50k</p>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-silver-500">Annual Opportunity Loss</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1 serif">0</p>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-silver-500">Missed Opportunities with AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(AppView.CHECKOUT)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#050504] shadow-xl hover:scale-105 transition-all"
            >
              Recover that revenue
            </button>
          </div>
          <div className="relative flex flex-col items-center gap-6 overflow-visible">
              <div
              className="relative group z-10 mb-16 min-h-[18rem] origin-top scale-[0.72] sm:mb-14 sm:min-h-[20rem] sm:scale-90 md:mb-10 md:min-h-[22rem] md:scale-100"
            >
              <DisplayCards 
                cards={[
                  {
                    icon: <PhoneCall className="size-4 text-red-400" />,
                    title: "Missed Opportunity",
                    description: "$12,000 Anniversary Inquiry",
                    date: "Sunday, 8:14 PM",
                    iconClassName: "text-red-500",
                    titleClassName: "text-red-500",
                    className: "[grid-area:stack] -translate-y-4 hover:-translate-y-6 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <PhoneCall className="size-4 text-red-400" />,
                    title: "Missed Opportunity",
                    description: "$8,500 Engagement Lead",
                    date: "Saturday, 9:30 PM",
                    iconClassName: "text-red-500",
                    titleClassName: "text-red-500",
                    className: "[grid-area:stack] translate-x-8 translate-y-1 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
                  },
                  {
                    icon: <PhoneCall className="size-4 text-red-400" />,
                    title: "Missed Opportunity",
                    description: "$15,000 Watch Inquiry",
                    date: "Yesterday, 11:45 PM",
                    iconClassName: "text-red-500",
                    titleClassName: "text-red-500",
                    className: "[grid-area:stack] translate-x-16 translate-y-8 hover:translate-y-6",
                  },
                ]}
              />
            </div>
            <div className="relative z-20 w-full max-w-sm p-4 md:p-6 glass-card rounded-xl md:rounded-[2rem] border-white/10 text-[#050504] shadow-2xl">
              <p className="italic text-sm md:text-lg serif leading-tight">"We missed a $12k anniversary lead on a Sunday. Never again."</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1a1714] md:mt-4">— London Diamonds</p>
            </div>
          </div>
        </div>
      </section>

      {/* Outbound Calls Section */}
      <section className="min-h-screen flex flex-col justify-center py-20 px-6 bg-transparent transition-colors relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`
              : `linear-gradient(to right, rgba(12,11,9,0.14) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(12,11,9,0.14) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            maskSize: '100% 100%',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 md:h-72">
          <WhenNear className="h-full w-full">
            <DottedSurface
              isDarkMode={isDarkMode}
              className="h-full w-full opacity-80 [mask-image:linear-gradient(to_top,black,transparent)]"
            />
          </WhenNear>
        </div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20 relative z-10">
          <div className="order-2 md:order-1 flex-1 space-y-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold serif leading-[1.1] text-slate-900">Proactive <br/><span className="italic shimmer-text">Reach</span></h2>
            <p className="text-base sm:text-lg text-navy-800 font-light leading-relaxed">
              Fourcee doesn't just wait for customers. It actively nurtures your pipeline with high-fidelity outbound reminders and follow-ups.
            </p>
            <div className="grid grid-cols-2 gap-8 pt-4">
              <div className="glass-card p-6 rounded-3xl">
                <p className="text-4xl font-bold serif text-navy-900 dark:text-white">30%</p>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-navy-400 mt-2">No-show reduction</p>
              </div>
              <div className="glass-card p-6 rounded-3xl">
                <p className="text-4xl font-bold serif text-navy-900 dark:text-white">2x</p>
                <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-navy-400 mt-2">Follow-up speed</p>
              </div>
            </div>
            <button
              type="button"
              onClick={scrollToPricing}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-7 py-3 text-[10px] font-bold uppercase tracking-[0.25em] shadow-2xl hover:scale-105 active:scale-95 transition-all w-full sm:w-auto justify-center"
            >
              <span>Select a package</span>
            </button>
          </div>
          <div className="order-1 md:order-2 flex-1 relative flex items-center justify-center">
            <WhenNear className="w-full">
              <IncomingCallPhone className="w-full max-w-[260px] sm:max-w-[320px]" isDarkMode={isDarkMode} />
            </WhenNear>
          </div>
        </div>
      </section>

      {/* Integrations Section - contained on mobile, no horizontal overflow */}
      <section className="min-h-screen flex flex-col justify-center pt-32 pb-16 overflow-x-hidden bg-transparent transition-colors">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 min-w-0">
          <div className="text-center mb-16 md:mb-24 max-w-3xl mx-auto">
            <h2 className="mb-5 overflow-visible break-words px-4 text-xl font-bold serif text-navy-900 sm:text-2xl md:mb-7 md:text-3xl">
              Unified Workflow
            </h2>
            <p className="text-slate-600 dark:text-navy-400 uppercase tracking-[0.2em] text-[11px] font-bold mb-6">Built for your current stack</p>
            <p className="text-base sm:text-lg text-slate-800 dark:text-navy-300 font-light leading-relaxed">
              Fourcee integrates seamlessly with the tools you already use. From deep Nivoda inventory sync to global e-commerce leaders, your existing workflow remains untouched, only enhanced.
            </p>
            <button
              type="button"
              onClick={() => navigate(AppView.LEAD_MAGNET)}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] shadow-lg hover:scale-105 transition-all"
            >
              View my custom audit
            </button>
          </div>

          <div className="mb-16 flex w-full justify-center md:mb-24">
            <figure className="w-full max-w-5xl">
              <img
                src={workflowImage}
                loading="lazy"
                decoding="async"
                alt="Connected digital ecosystem"
                className="mx-auto h-auto max-h-[440px] w-full rounded-[2rem] object-contain brightness-95 [mask-image:radial-gradient(ellipse_at_center,black_46%,transparent_78%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_46%,transparent_78%)]"
              />
              <figcaption className="mx-auto mt-2 max-w-xl px-4 text-center">
                <h3 className={`mb-2 font-serif text-2xl font-bold italic sm:text-3xl ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>The Synchronized Showroom</h3>
                <p className={`text-sm font-light sm:text-base ${isDarkMode ? 'text-white/80' : 'text-slate-800'}`}>Fourcee acts as the intelligent bridge between your client interactions and your inventory, scheduling, and CRM systems.</p>
              </figcaption>
            </figure>
          </div>

          <div id="integrations-h-track" className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
            {INTEGRATIONS_DATA.map((cat, idx) => (
              <div key={idx} className="glass-card flex w-full min-w-0 flex-col rounded-[2rem] border border-navy-50 p-5 dark:border-navy-800 sm:rounded-[3rem] sm:p-10">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-navy-400 mb-6">{cat.category}</h4>
                <div className="flex flex-wrap gap-2 mb-6">
                  {cat.popular.map(p => (
                    <span key={p} className="px-4 py-2 bg-navy-900 dark:bg-white text-white dark:text-navy-950 rounded-full text-xs font-bold tracking-tight shadow-sm">
                      {p}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-navy-500 dark:text-navy-400 leading-relaxed mb-8 flex-1">
                  {cat.description}
                </p>
                <button 
                  onClick={() => setExpandedIntegration(expandedIntegration === idx ? null : idx)}
                  className="text-[10px] font-bold uppercase tracking-widest text-navy-900 dark:text-white border-b border-navy-900/20 dark:border-white/20 pb-1 w-fit hover:border-navy-900 dark:hover:border-white transition-all"
                >
                  {expandedIntegration === idx ? 'Close Details ↑' : 'View Others ↓'}
                </button>
                {expandedIntegration === idx && (
                  <div className="mt-8 pt-8 border-t border-navy-50 dark:border-navy-800 animate-in slide-in-from-top-4">
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {cat.others.map(other => (
                        <div key={other} className="flex items-center gap-2">
                          <div className="w-1 h-1 bg-navy-200 dark:bg-navy-700 rounded-full" />
                          <span className="text-xs font-medium text-navy-400 dark:text-navy-500">{other}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nivoda Deep Integration Section - inverts for light mode */}
      <section
        className="min-h-[80vh] flex flex-col justify-center px-6 py-16 md:py-24 relative transition-colors"
        style={{
          backgroundColor: isDarkMode ? '#090906' : '#f4f5f7',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDarkMode
              ? `repeating-radial-gradient(circle at 0 0, rgba(194,204,214,0.12) 0, rgba(194,204,214,0.12) 1px, transparent 1px, transparent 3px)`
              : `repeating-radial-gradient(circle at 0 0, rgba(12,11,9,0.08) 0, rgba(12,11,9,0.08) 1px, transparent 1px, transparent 3px)`,
            opacity: 0.9,
          }}
        />
        <div className="relative max-w-6xl mx-auto grid gap-10 lg:gap-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center">
          <div className="relative flex items-center justify-center order-1">
            <div className="aspect-[4/5] w-full max-w-[220px] overflow-hidden rounded-[2rem] sm:max-w-[260px] md:max-w-md [mask-image:radial-gradient(ellipse_at_center,black_58%,transparent_88%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black_58%,transparent_88%)]">
              <svg
                viewBox="0 0 100 125"
                className={`w-full h-full ${!isDarkMode ? 'invert' : ''}`}
                aria-label="Nivoda inventory layers feeding Fourcee"
                role="img"
              >
                <defs>
                  <filter id="nivoda-soft-feather">
                    <feGaussianBlur stdDeviation="18" />
                  </filter>
                  <mask id="nivoda-soft-mask">
                    <rect width="100" height="125" fill="black" />
                    <rect
                      x="10"
                      y="10"
                      width="80"
                      height="105"
                      rx="20"
                      ry="20"
                      fill="white"
                      filter="url(#nivoda-soft-feather)"
                    />
                  </mask>
                </defs>
                <image
                  href={nivodaGif}
                  x="0"
                  y="0"
                  width="100"
                  height="125"
                  preserveAspectRatio="xMidYMid slice"
                  mask="url(#nivoda-soft-mask)"
                />
              </svg>
            </div>
          </div>
          <div className="space-y-6 text-left order-2">
            <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${isDarkMode ? 'text-[#ddd4c6]/80' : 'text-navy-600/80'}`}>
              Nivoda-native inventory intelligence
            </p>
            <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold serif tracking-tight ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>
              Your AI hears<br className="hidden sm:block" /> the same diamonds you see.
            </h2>
            <p className={`text-sm sm:text-base max-w-xl leading-relaxed ${isDarkMode ? 'text-[#ddd4c6]/90' : 'text-navy-700/90'}`}>
              Fourcee doesn&apos;t guess what&apos;s in your case - it reads live data from Nivoda. Every search,
              estimate and availability check is backed by the same inventory spine your buyers already trust.
            </p>
            <div className={`grid gap-4 sm:grid-cols-2 text-xs sm:text-sm ${isDarkMode ? 'text-[#ddd4c6]' : 'text-navy-700'}`}>
              <div className={`rounded-2xl border px-4 py-3 backdrop-blur-md ${isDarkMode ? 'border-[#535B68]/60 bg-black/40' : 'border-navy-200 bg-white/80'}`}>
                <p className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>Real-time availability</p>
                <p className="leading-relaxed">
                  Quote from live Nivoda feeds so your AI never offers stones that have already left the pipeline.
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 backdrop-blur-md ${isDarkMode ? 'border-[#8a7349]/70 bg-black/40' : 'border-navy-200 bg-white/80'}`}>
                <p className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>Smart search logic</p>
                <p className="leading-relaxed">
                  Translate vague requests (&quot;oval, lab-grown, under 3 carats&quot;) into structured Nivoda queries
                  in the background.
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 backdrop-blur-md sm:col-span-2 ${isDarkMode ? 'border-[#535B68]/60 bg-black/40' : 'border-navy-200 bg-white/80'}`}>
                <p className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-navy-900'}`}>CRM + analytics ready</p>
                <p className="leading-relaxed">
                  Every Nivoda-backed search can be logged against a contact in your CRM and surfaced in the analytics
                  portal - so you see which profiles are driving real diamond demand.
                </p>
              </div>
            </div>
            <p className={`text-[10px] uppercase tracking-[0.25em] pt-2 ${isDarkMode ? 'text-[#ddd4c6]/70' : 'text-navy-600/70'}`}>
              Built to sit on top of your existing Nivoda workflows - not replace them.
            </p>
            <button
              type="button"
              onClick={() => navigate(AppView.CHECKOUT)}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg transition ${
                isDarkMode
                  ? 'bg-white text-navy-950 hover:bg-white/90'
                  : 'bg-navy-900 text-white hover:bg-navy-800'
              }`}
            >
              Start concierge rollout
            </button>
          </div>
        </div>
      </section>





      {/* Solutions / Features — horizontal liquid-glass cards */}
      <section className="min-h-[70vh] flex flex-col justify-center pt-12 pb-12 md:pt-16 md:pb-16 px-6 bg-transparent transition-colors relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDarkMode
              ? `linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`
              : `linear-gradient(to right, rgba(12,11,9,0.14) 1px, transparent 1px),
                 linear-gradient(to bottom, rgba(12,11,9,0.14) 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
            maskSize: '100% 100%',
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative z-10 px-4 w-full min-w-0 overflow-x-hidden">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold serif text-navy-900 mb-4 tracking-tight">Boutique Intelligence</h2>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {[
              { title: "Voice Cloning", desc: "Your actual voice, scaled across 100 simultaneous calls." },
              { title: "Live Estimates", desc: "Instant pricing based on daily market spot rates." },
              { title: "VIP Escalation", desc: "Escalation rules for your top clients, set up with you during onboarding." }
            ].map((f, i) => (
              <div
                key={i}
                className="liquid-glass min-w-0 rounded-2xl p-5 text-left transition-all hover:shadow-xl group sm:p-6"
              >
                <div className="w-9 h-9 bg-navy-900 rounded-xl mb-4 flex items-center justify-center text-white font-bold text-sm group-hover:scale-105 transition-transform border border-[#c8b58f]/40">
                  {i + 1}
                </div>
                <h3 className="text-sm sm:text-base font-bold serif mb-2 text-navy-900">{f.title}</h3>
                <p className="text-[12px] sm:text-sm leading-relaxed text-navy-600 font-medium normal-case tracking-normal">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => setShowDemoCallModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 dark:bg-white text-white dark:text-navy-950 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] shadow-xl hover:scale-[1.03] active:scale-95 transition-all"
            >
              Get a concierge callback
            </button>
          </div>
        </div>
      </section>

      <section id="signal-faq" className="flex flex-col justify-center scroll-mt-24 py-16 md:py-20 px-6 bg-transparent transition-colors relative">
        <div className="max-w-5xl mx-auto relative z-10 px-4 sm:px-6 w-full min-w-0">
          <div className="mb-5 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(AppView.CHECKOUT)}
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 text-white dark:bg-white dark:text-navy-950 px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.22em] shadow-lg hover:scale-105 transition-all"
            >
              Get Fourcee now
            </button>
          </div>
          <FaqMonochrome
            isDarkMode={isDarkMode}
            faqs={FAQ_ITEMS}
            steps={JOURNEY_STEPS}
          />
        </div>
      </section>

      {/* Final snap point just above footer so bottom doesn't bounce */}
      <div className="h-0" />

    </div>
  ); }; }, []); // stable component type — live data via landingLiveRef + landingBump

  const BlogPage = () => (
    <div className="pt-24 pb-12 px-6 max-w-6xl mx-auto animate-in fade-in duration-700 bg-transparent">
      <div className="flex justify-center mb-8">
        <img
          src={isDarkMode ? fcWhite : fcBlack}
          alt="Fourcee mark"
          className="h-16 w-auto object-contain sm:h-20 md:h-24"
        />
      </div>
      <h1 className="text-4xl font-bold serif mb-4 text-center tracking-tighter text-slate-900 dark:text-white">The Ledger</h1>
      <p className="text-center text-slate-600 dark:text-navy-300 uppercase tracking-[0.3em] text-[10px] font-bold mb-20">Strategic Insights for Luxury Retailers</p>
      
      <div className="grid md:grid-cols-2 gap-10 md:gap-16">
        {BLOG_POSTS.map(post => (
          <button
            key={post.id}
            type="button"
            onClick={() => navigate(AppView.BLOG_POST, post)}
            className="text-left"
          >
            <ArticleCard
              headline={post.title}
              excerpt={post.excerpt}
              cover={post.imageUrl.startsWith('http') ? post.imageUrl : assetUrl(post.imageUrl)}
              tag="Insight"
              readingTimeSeconds={420}
              writer="Alyssa Peters"
              publishedLabel={post.date}
              clampLines={3}
              isDarkMode={isDarkMode}
            />
          </button>
        ))}
      </div>
    </div>
  );

  const TermsPage = () => (
    <div className="pt-24 pb-16 px-6 max-w-4xl mx-auto animate-in fade-in duration-700 bg-transparent">
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold serif mb-5 tracking-tighter text-navy-950">
        Safeguards, Disclaimer & Terms
      </h1>
      <p className="text-sm text-navy-500 dark:text-navy-300 mb-8 leading-relaxed">
        This page is a plain-language overview of how we structure deployments of Fourcee. It is not a substitute for a
        signed services agreement, but it explains the spirit in which we work with jewelers.
      </p>

      <div className="space-y-8 text-sm text-navy-700 dark:text-navy-200 leading-relaxed">
        <section>
          <h2 className="font-bold text-navy-900 dark:text-white mb-2">Commercial terms & payment</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Setup fee.</span> For standard monthly subscriptions, a one-time setup fee
              applies by tier. If you pay annually for a published plan, that setup fee is typically waived. Custom
              agreements may differ. When a setup fee applies, it is charged once per showroom and covers discovery,
              call-flow design, integrations (including Nivoda, calendars and CRM), test environment, and iterative
              tuning.
            </li>
            <li>
              <span className="font-semibold">First payment - but only after sign-off.</span> We typically collect your
              first month or annual subscription (and any applicable setup fee) before go-live. Billing for the
              subscription period only begins once testing is complete and you confirm in writing that you are happy
              for Fourcee to go live.
            </li>
            <li>
              <span className="font-semibold">Ongoing subscription.</span> After go-live, you pay a recurring
              subscription as per your selected tier. Any changes to pricing, terms or scope are always agreed in
              writing.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-navy-900 dark:text-white mb-2">Usage, data & privacy</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-semibold">Call recording & analytics.</span> Wherever legally permitted and
              contractually agreed, calls may be recorded, transcribed and analysed to improve performance. You can
              choose how long recordings are stored and who in your team can access them.
            </li>
            <li>
              <span className="font-semibold">Third‑party tools.</span> Fourcee connects to services such as Nivoda,
              CRMs and calendar systems. Each of those tools has its own terms; using them through Fourcee means you
              also agree to their respective terms and privacy policies.
            </li>
            <li>
              <span className="font-semibold">Your data stays yours.</span> Customer data and call history belong to
              your business. We process that data solely to deliver and improve the service, in line with the agreement
              we sign together.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-navy-900 dark:text-white mb-2">ROI calculator & performance disclaimer</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              The ROI calculator and case studies on this site are <span className="font-semibold">illustrative</span>{' '}
              only. They use assumptions about close rates, missed call capture and staffing efficiencies that may not
              match your exact business.
            </li>
            <li>
              Actual performance depends on many factors outside of our control - including your offer, pricing,
              competition, sales process and macroeconomic conditions. We therefore cannot promise or guarantee a
              specific revenue outcome.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-navy-900 dark:text-white mb-2">Limitations of liability</h2>
          <p>
            While we design Fourcee with guardrails, testing and sensible defaults, no AI system is perfect. To the
            maximum extent permitted by law, our liability for any indirect, incidental or consequential loss is
            excluded. Direct losses are limited to the fees you have paid to us over a defined recent period, as set out
            in the formal agreement.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-navy-900 dark:text-white mb-2">Need the full legal text?</h2>
          <p>
            Before deployment we will share a full services agreement or order form for review and signature. That
            document will always govern in the event of any conflict with this summary.
          </p>
        </section>
      </div>
    </div>
  );

  if (!isReady) {
    return <SplashScreen onComplete={() => setIsReady(true)} />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="relative h-screen flex flex-col overflow-y-auto overflow-x-hidden dark:bg-navy-950 transition-colors overscroll-y-contain snap-none"
      style={{
        background: 'linear-gradient(180deg, #faf5ea 0%, #f8f1e2 38%, #f6efdf 100%)',
      }}
    >
      <div className="fixed inset-0 z-0 pointer-events-none fourcee-grain-lite" />

      {currentView === AppView.LANDING && (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 py-5 sm:px-10">
          <div className="fx-logo-negative fx-hud inline-flex items-center gap-2.5 text-[11px]">
            <span className="h-[18px] w-[18px] shrink-0 rounded-full border border-white/80 bg-[radial-gradient(circle_at_35%_30%,#f7e7b8,#b8913f_60%,#5c4318)]" />
            <span>FOURCEE CONCIERGE</span>
          </div>
        </div>
      )}
      
      {isSideMenuOpen && (
        <div className="fixed inset-0 z-[1200]">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setIsSideMenuOpen(false)}
            aria-label="Close side menu backdrop"
          />
          <aside
            className="fourcee-surface-bg absolute left-0 top-0 h-full w-[min(92vw,420px)] border-r border-[#d9c39a]/80 dark:border-[#c8b58f]/25 shadow-2xl overflow-y-auto"
          >
            <div className="relative z-10 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#3a342b] dark:text-[#c8b58f]">Concierge app menu</p>
              <button
                type="button"
                onClick={() => setIsSideMenuOpen(false)}
                className="h-9 w-9 rounded-full border border-[#d9c39a]/80 dark:border-[#c8b58f]/35 flex items-center justify-center text-[#0c0b09] dark:text-[#faf5ea]"
                aria-label="Close side menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex justify-center">
              <img
                src={isDarkMode ? fcWhite : fcBlack}
                alt="Fourcee"
                className="h-16 w-auto object-contain sm:h-20 opacity-100"
              />
            </div>
            <div className="mt-5 rounded-2xl border border-[#d9c39a]/80 bg-[#0c0b09] dark:bg-[#faf5ea] p-4">
              <p className="text-[11px] font-semibold text-[#faf5ea] dark:text-[#0c0b09]">{businessName}</p>
              <p className="mt-1 text-xs text-[#ddd4c6] dark:text-[#3a342b]">Prepared brief for this showroom.</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {([
                { label: 'Home', sub: 'Main journey', icon: <House className="h-4 w-4" />, action: () => navigate(AppView.LANDING) },
                { label: 'Ring Builder', sub: '3D lead magnet', icon: <Gem className="h-4 w-4" />, action: () => goToRingBuilder() },
                { label: 'Audit', sub: 'Custom report', icon: <FileSearch className="h-4 w-4" />, action: () => navigate(AppView.LEAD_MAGNET) },
                { label: 'Checkout', sub: 'Plans and pricing', icon: <CreditCard className="h-4 w-4" />, action: () => navigate(AppView.CHECKOUT) },
                ...(calUrl ? [{ label: 'Book Call', sub: 'Strategy meeting', icon: <CalendarDays className="h-4 w-4" />, href: calUrl }] : []),
              ] as Array<{ label: string; sub: string; icon: React.ReactNode; action?: () => void; href?: string }>).map((item) => {
                const tile = (
                  <>
                    <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#0c0b09] dark:bg-[#faf5ea] text-[#faf5ea] dark:text-[#0c0b09]">
                      {item.icon}
                    </div>
                    <p className="mt-2 text-xs font-semibold text-[#0c0b09] dark:text-[#faf5ea]">{item.label}</p>
                    <p className="mt-1 text-[11px] text-[#3a342b] dark:text-[#c8b58f]">{item.sub}</p>
                  </>
                );
                const tileClass = 'rounded-[1.25rem] min-h-[96px] border border-[#d9c39a]/70 dark:border-[#c8b58f]/30 px-3 py-3 text-left bg-[#fbf4e7] dark:bg-[#1a1712] hover:bg-white dark:hover:bg-[#242018] transition';
                return item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsSideMenuOpen(false)}
                    className={tileClass}
                  >
                    {tile}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action?.();
                      setIsSideMenuOpen(false);
                    }}
                    className={tileClass}
                  >
                    {tile}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl border border-[#d9c39a]/70 dark:border-[#c8b58f]/25 bg-[#fbf4e7]/90 dark:bg-[#1a1712] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#3a342b] dark:text-[#c8b58f]">Onboarding & help</p>
              <p className="mt-2 text-xs text-[#0c0b09] dark:text-[#faf5ea]">
                Home, audit, checkout and the ring studio. Press Escape or tap outside to close this menu.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(AppView.LANDING);
                    setIsSideMenuOpen(false);
                  }}
                  className="rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] border border-[#d9c39a]/80 dark:border-[#c8b58f]/35 text-[#0c0b09] dark:text-[#faf5ea]"
                >
                  Return home
                </button>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-[#d9c39a]/80 dark:border-[#c8b58f]/30 bg-[#fbf4e7] dark:bg-[#1a1712] p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[#3a342b] dark:text-[#c8b58f]">Quick ROI calculator</p>
              <div className="mt-3 space-y-3">
                <label className="block text-[11px] text-[#0c0b09] dark:text-[#faf5ea]">
                  Missed qualified calls / month: <span className="font-semibold">{sideMenuCallsPerMonth}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={40}
                  step={1}
                  value={sideMenuCallsPerMonth}
                  onChange={(e) => setSideMenuCallsPerMonth(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <label className="block text-[11px] text-[#0c0b09] dark:text-[#faf5ea]">
                  Average deal value: <span className="font-semibold">${dealValue.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={1000}
                  max={20000}
                  step={250}
                  value={dealValue}
                  onChange={(e) => setSideMenuAvgDeal(snapDeal(Number(e.target.value)))}
                  className="w-full accent-emerald-600"
                />
                <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Est. monthly recovered</p>
                  <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">${sideMenuRecoveredMonthly.toLocaleString()}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView(AppView.CHECKOUT);
                    setIsSideMenuOpen(false);
                  }}
                  className="w-full rounded-xl bg-[#0c0b09] text-[#faf5ea] dark:bg-[#faf5ea] dark:text-[#0c0b09] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] shadow-md"
                >
                  Activate concierge plan
                </button>
              </div>
            </div>
            <div className="mt-6 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-800 dark:text-emerald-300">ROI reminder</p>
              <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-100">
                Recovering one serious customer can pay for multiple months of concierge coverage and analytics.
              </p>
            </div>
            </div>
          </aside>
        </div>
      )}
      {!isSideMenuOpen && (
      <FloatingNav
        onNavigate={navigate}
        currentView={currentView}
        toggleDarkMode={toggleDarkMode}
        isDarkMode={isDarkMode}
        onOpenMenu={() => setIsSideMenuOpen(true)}
        bookingHref={calUrl || undefined}
      />
      )}

      <main className="relative z-10">
        {currentView === AppView.LANDING && <LandingPage scrollContainerRef={scrollContainerRef} />}
        {currentView === AppView.LEAD_MAGNET && (
          <Suspense fallback={null}>
            <AuditPage
              brief={gateBrief ?? briefFromAudit(auditData)}
              isDarkMode={isDarkMode}
              onGetLive={() => navigate(AppView.CHECKOUT)}
              onBookCall={openCalendarBooking}
            />
          </Suspense>
        )}
        {currentView === AppView.BLOG && <BlogPage />}
        {currentView === AppView.BLOG_POST && selectedPost && (
           <div className="pt-24 animate-in fade-in duration-700">
              <button onClick={() => navigate(AppView.BLOG)} className="px-6 py-12 text-navy-300 hover:text-navy-900 dark:hover:text-white uppercase text-[10px] font-bold tracking-widest transition-colors">← Back to Ledger</button>
              <div className="max-w-3xl mx-auto px-6 pb-12">
                <h1 className="text-3xl md:text-4xl font-bold serif mb-12 leading-none dark:text-white">{selectedPost.title}</h1>
                <div className="prose prose-navy dark:prose-invert max-w-none">
                  {selectedPost.imageUrl ? (
                    <img
                      src={selectedPost.imageUrl.startsWith('http') ? selectedPost.imageUrl : assetUrl(selectedPost.imageUrl)}
                      alt=""
                      className="mb-10 w-full max-h-80 object-cover rounded-2xl border border-navy-200/40 dark:border-white/10"
                    />
                  ) : null}
                  {renderSimpleMarkdown(selectedPost.content)}
                </div>
              </div>
           </div>
        )}
        {currentView === AppView.CHECKOUT && (
          <Suspense fallback={null}>
            <CheckoutFlow
              isDarkMode={isDarkMode}
              initialPackageId={preSelectedPackageId}
            />
          </Suspense>
        )}
        {ADMIN_ENABLED && AdminDashboard && currentView === AppView.ADMIN && (
          <React.Suspense fallback={null}><AdminDashboard isDarkMode={isDarkMode} /></React.Suspense>
        )}
        {currentView === AppView.TERMS && <TermsPage />}
      </main>

      {/* Global footer — dotted ball field fills the band above Terms (no empty gap) */}
      <footer className="relative w-full min-h-[200px] h-[min(28vh,240px)] flex-shrink-0 overflow-visible z-20 -mt-4">
        <div
          className="absolute inset-0 rounded-t-[2rem]"
          style={{
            background:
              currentView === AppView.LEAD_MAGNET
                ? 'linear-gradient(to bottom, #f2e8d2 0%, #f6efdf 28%, #f8f1e2 58%, #faf5ea 100%)'
                : 'linear-gradient(to bottom, rgba(250,245,234,0) 0%, rgba(248,241,226,0.55) 18%, #faf5ea 55%, #f6efdf 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(12,11,9,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(12,11,9,0.07) 1px, transparent 1px)',
            backgroundSize: currentView === AppView.LEAD_MAGNET ? '28px 28px' : '32px 32px',
            opacity: 0.28,
            maskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 78%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 40%, transparent 78%)',
          }}
        />
        <WhenNear className="absolute inset-0 z-[5] h-full w-full">
          <DottedSurface
            isDarkMode={false}
            className="h-full w-full opacity-100 -translate-y-3 [mask-image:linear-gradient(to_top,black_78%,transparent_100%)]"
          />
        </WhenNear>
        <div className="absolute inset-0 z-[20] flex items-end justify-center footer-terms-clearance px-4 pointer-events-none">
          <button
            type="button"
            onClick={() => navigate(AppView.TERMS)}
            className="pointer-events-auto liquid-glass text-[10px] font-bold uppercase tracking-[0.18em] rounded-full px-5 py-2.5 transition-colors text-navy-900 hover:brightness-105"
          >
            Terms, safeguards &amp; disclaimer
          </button>
        </div>
      </footer>
      <Suspense fallback={null}>
        <FloatingAiAssistant />
      </Suspense>
    </div>
  );
};

export default App;
