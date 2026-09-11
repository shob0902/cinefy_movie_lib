// Catches render-time crashes and offers a reload.
import { Component, type ErrorInfo, type ReactNode } from 'react';
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, marginBottom: 10 }}>Something broke</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          The app hit an unexpected error and could not finish rendering this screen.
        </p>
        <button
          type="button"
          className="linkButton"
          onClick={() => {
            window.location.assign('/');
          }}
        >
          Reload the app
        </button>
      </div>
    );
  }
}
