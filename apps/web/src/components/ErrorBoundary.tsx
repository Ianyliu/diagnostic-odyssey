import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {error: null};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unexpected application render error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <main id="main-content" className="page error-boundary-page" tabIndex={-1}>
        <section className="state-card error error-boundary-fallback" role="alert" aria-labelledby="unexpected-error-title">
          <p className="eyebrow">INTERFACE ERROR</p>
          <h1 id="unexpected-error-title">The interface encountered an unexpected error.</h1>
          <p>No substitute evidence or estimate has been created. Reload the interface to retry the current route.</p>
          <div className="error-boundary-actions">
            <button className="button" type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
            <a className="button secondary" href="/">
              Return to overview
            </a>
          </div>
          <details className="error-boundary-details">
            <summary>Technical details</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </section>
      </main>
    </>;
  }
}
