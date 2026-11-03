import React from 'react';
import { Menu } from 'lucide-react';
import { AppView } from '../types';

/** Slightly thinner strokes for a lighter nav read */
const sw = 1.35;

interface FloatingNavProps {
  onNavigate: (view: AppView) => void;
  currentView: AppView;
  toggleDarkMode?: () => void;
  isDarkMode?: boolean;
  onOpenMenu?: () => void;
  /** Opens in a new tab. Empty hides the Book control. */
  bookingHref?: string;
}

/**
 * SpaceX / Grok-simple dock: few clear actions, generous tap targets.
 * Secondary destinations (Ops, walkthrough, ROI) live in the side menu. Light theme only.
 */
export const FloatingNav: React.FC<FloatingNavProps> = ({
  onNavigate,
  currentView,
  isDarkMode = false,
  onOpenMenu,
  bookingHref,
}) => {
  const isActive = (view: AppView) => currentView === view;
  const iconBtn = isDarkMode
    ? 'text-white/90 hover:text-white hover:bg-white/10'
    : 'text-navy-800 hover:text-navy-950 hover:bg-navy-900/5';

  const homeActive = isActive(AppView.LANDING);
  const auditActive = isActive(AppView.LEAD_MAGNET);

  return (
    <div className="nav-floating animate-in slide-in-from-bottom duration-700 w-full max-w-[calc(100vw-1.5rem)] sm:max-w-none">
      <div className="relative liquid-glass-dock shadow-2xl rounded-full pl-2 pr-2 sm:pl-3 sm:pr-3 py-2 sm:py-2.5 flex items-center justify-center gap-1 sm:gap-2 transition-all mx-auto w-fit max-w-full">
        <div className="pointer-events-none absolute inset-0 rounded-full border border-amber-300/25" />

        {/* 1 · Menu (side drawer holds the rest) */}
        {onOpenMenu && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={onOpenMenu}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors sm:h-12 sm:w-12 ${iconBtn}`}
              aria-label="Open menu"
              title="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* 2 · Home */}
        <DockItem
          label="Home"
          active={homeActive}
          isDarkMode={isDarkMode}
          onClick={() => onNavigate(AppView.LANDING)}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={sw}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        />

        {/* 3 · Audit */}
        <DockItem
          label="Audit"
          active={auditActive}
          isDarkMode={isDarkMode}
          onClick={() => onNavigate(AppView.LEAD_MAGNET)}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={sw}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          }
        />

        <div className="w-px h-6 bg-navy-200 dark:bg-white/20 mx-0.5 sm:mx-1 shrink-0" />

        {/* 4 · Book */}
        {bookingHref ? (
          <a
            href={bookingHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex h-11 sm:h-12 items-center px-3.5 sm:px-4 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] shrink-0 border border-dashed border-[#d4af37] transition-all hover:scale-[1.03] active:scale-95 ${
              isDarkMode ? 'text-white/95 bg-white/5' : 'text-navy-900 bg-navy-900/[0.03]'
            }`}
          >
            Book
          </a>
        ) : null}

        {/* 5 · Primary CTA */}
        <button
          type="button"
          onClick={() => onNavigate(AppView.CHECKOUT)}
          className={`h-11 sm:h-12 px-4 sm:px-5 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-[0.14em] shrink-0 bg-[#0c0b09] text-[#faf5ea] hover:brightness-125 active:scale-95 ${
            isActive(AppView.CHECKOUT) ? 'shadow-lg scale-105' : 'hover:shadow-xl hover:scale-105'
          }`}
        >
          {isActive(AppView.CHECKOUT) ? 'Paying' : 'Get Fourcee'}
        </button>
      </div>
    </div>
  );
};

const DockItem: React.FC<{
  onClick: () => void;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  isDarkMode?: boolean;
}> = ({ onClick, active, label, icon, isDarkMode = true }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    data-theme={isDarkMode ? 'dark' : 'light'}
    className={`flex h-11 sm:h-12 items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 rounded-full transition-all duration-300 shrink-0 ${
      active
        ? 'bg-[#0c0b09] text-[#faf5ea] shadow-md scale-105'
        : 'text-[#1a1714] hover:bg-black/5'
    }`}
  >
    {icon}
    <span
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
        active ? 'inline' : 'hidden sm:inline opacity-70'
      }`}
    >
      {label}
    </span>
  </button>
);
