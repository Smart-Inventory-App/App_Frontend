import React, { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc } from './trpc';
import { getTRPCClient, queryClient } from './trpcClient';

interface TRPCProviderProps {
  children: ReactNode;
}

/**
 * tRPC Provider for wrapping your app
 * Must wrap your entire app for tRPC to work
 */
export function TRPCProvider({ children }: TRPCProviderProps) {
  const trpcClient = React.useMemo(() => getTRPCClient(), []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
