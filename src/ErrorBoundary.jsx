// Efiko — top-level error boundary. Catches any render/runtime error in the tree so a
// single broken component (e.g. a lazy chunk that failed to load) shows a friendly,
// offline-safe recovery screen instead of a blank white page.
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep a breadcrumb in the console; no external reporting (privacy + offline).
    console.error('Efiko caught an error:', error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app">
          <div className="boundary">
            <h2>Something went wrong</h2>
            <p>The app hit an unexpected error. Your saved lessons are safe offline.</p>
            <button className="boundary-btn" onClick={() => window.location.reload()}>Reload</button>
            <button className="boundary-link" onClick={() => { window.location.href = window.location.pathname; }}>Back to my courses</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
