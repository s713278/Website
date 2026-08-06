import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/shared/lib/query-client';
import { env } from '@/shared/lib/env';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ErrorBoundary fallbackTitle="Application error">
      <QueryClientProvider client={queryClient}>
        {children}
        {env.isDev && env.VITE_ENABLE_QUERY_DEVTOOLS ? (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        ) : null}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
