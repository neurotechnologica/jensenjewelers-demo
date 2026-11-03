import React, { Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { wantsShortPage } from './lib/cro';
import './index.css';

// Two entry chunks so the short prospect page never downloads the 3D / WebGi / charts bundle of the full app.
// `/` -> short page (default; VITE_CRO_SHORT=0 or ?v=full restores the legacy landing). Any #/route -> the existing app, unchanged.
const App = React.lazy(() => import('./App'));
const ShortAudit = React.lazy(() => import('./components/ShortAudit'));

function Root() {
  const [short, setShort] = useState(() => wantsShortPage());
  useEffect(() => {
    const on = () => setShort(wantsShortPage());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return <Suspense fallback={null}>{short ? <ShortAudit /> : <App />}</Suspense>;
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
