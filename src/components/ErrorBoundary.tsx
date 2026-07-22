import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary (e.g. pass the active tab id). */
  resetKey?: unknown;
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors in a subtree and shows a recoverable message
 * instead of unmounting to a blank white page. Resets automatically when
 * `resetKey` changes (so navigating away from a broken tab clears it).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="p-3 rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {this.props.label ? `${this.props.label} hit an error` : 'Something went wrong'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-1">
            This section crashed instead of loading. Your data is safe — try again, and if it keeps
            happening, share the details below.
          </p>
          <pre className="text-[11px] text-muted-foreground/80 bg-muted/50 rounded-md px-3 py-2 mb-4 max-w-lg overflow-x-auto text-left">
            {this.state.error.message || String(this.state.error)}
          </pre>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
