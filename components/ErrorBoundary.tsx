import React from 'react';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
};

type State = { hasError: boolean };

/** Prevents a missing lazy chunk / WebGL failure from blanking the whole SPA. */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[Fourcee ErrorBoundary]', this.props.label || 'section', error);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="rounded-[2rem] border border-amber-300/40 bg-navy-950/40 px-6 py-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200/80">
            {this.props.label || 'Studio'} unavailable
          </p>
          <p className="mt-3 text-sm text-slate-300">
            This interactive preview could not load. Continue with the audit or book a call — nothing else is broken.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
