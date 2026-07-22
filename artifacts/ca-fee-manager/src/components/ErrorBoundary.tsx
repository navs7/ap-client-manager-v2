import { Component, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isFirebase = /firebase/i.test(error.message) || /apikey/i.test(error.message);
    const isConfig = /import\.meta\.env/i.test(error.message) || /VITE_FIREBASE/i.test(error.message);

    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-3" />
          <h1 className="text-base font-semibold mb-2">The app failed to load</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {isConfig || isFirebase
              ? 'This looks like a missing Firebase configuration. Please make sure all VITE_FIREBASE_* secrets are set in the GitHub repository settings.'
              : 'Something went wrong while starting the app.'}
          </p>
          <div className="text-left text-xs bg-background rounded-lg border p-3 font-mono text-destructive whitespace-pre-wrap break-words">
            {error.name}: {error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
