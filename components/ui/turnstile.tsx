import * as React from 'react';

/** Optional Cloudflare Turnstile widget. Renders nothing unless siteKey (VITE_TURNSTILE_SITE_KEY) is set; the script is only loaded then. */
type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void };
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi | null> | null = null;
const api = () => (window as unknown as { turnstile?: TurnstileApi }).turnstile;
function loadScript(): Promise<TurnstileApi | null> {
  if (api()) return Promise.resolve(api()!);
  if (!loading) {
    loading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = SRC; s.async = true; s.defer = true;
      s.onload = () => resolve(api() ?? null);
      s.onerror = () => { loading = null; resolve(null); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export function Turnstile({ siteKey, onToken, resetKey = 0, theme = 'auto' }: { siteKey: string; onToken: (t: string) => void; resetKey?: number; theme?: 'auto' | 'light' | 'dark' }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const id = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!siteKey) return;
    let dead = false;
    loadScript().then((t) => {
      if (dead || !t || !ref.current) return;
      id.current = t.render(ref.current, { sitekey: siteKey, theme, size: 'flexible', callback: (tok: string) => onToken(tok), 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') });
    });
    return () => { dead = true; if (id.current) api()?.remove(id.current); id.current = undefined; };
  }, [siteKey]); // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (resetKey && id.current) { onToken(''); api()?.reset(id.current); } }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!siteKey) return null;
  return <div ref={ref} data-testid="turnstile" className="mb-3 min-h-[65px]" />;
}
