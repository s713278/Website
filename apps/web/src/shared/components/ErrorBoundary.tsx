import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>{this.props.fallbackTitle || 'Something went wrong'}</CardTitle>
            <CardDescription>
              This screen hit an unexpected error. You can retry or go back home.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="overflow-auto rounded-xl bg-md-green-soft/40 p-3 text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  this.setState({ error: null });
                }}
              >
                Try again
              </Button>
              <Button type="button" variant="secondary" onClick={() => (window.location.href = '/')}>
                Go home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
