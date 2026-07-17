import React from 'react';
import { useRouteError } from 'react-router-dom';

/** Route-level error element. */
export function ErrorBoundary(): React.ReactElement {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return (
    <div className="grid min-h-screen place-items-center bg-graphite-950 p-6">
      <div className="glass max-w-md space-y-3 p-6 text-center">
        <h1 className="text-lg font-semibold text-signal-rose">Something went wrong</h1>
        <p className="text-sm text-slate-400">{message}</p>
        <div className="flex justify-center gap-2">
          <a className="btn-primary" href="#/">
            Back to dashboard
          </a>
          <button className="btn-ghost" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

interface CatchState {
  hasError: boolean;
  message: string;
}

/** Component-level error boundary for isolating widget crashes. */
export class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  CatchState
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: unknown): CatchState {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }
  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="glass p-4 text-xs text-signal-rose">
          {this.props.label ?? 'This panel'} failed to render: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
