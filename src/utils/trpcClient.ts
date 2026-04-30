import { httpBatchLink } from '@trpc/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { trpc } from './trpc';

/**
 * Get tRPC client configuration
 * Handles authentication tokens and API URL configuration
 */
export function getTRPCClient() {
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${API_URL}/trpc`,
        // Add auth token to requests
        async headers() {
          const token = await AsyncStorage.getItem('access_token');
          return {
            authorization: token ? `Bearer ${token}` : '',
          };
        },
      }),
    ],
  });
}

/**
 * Create React Query client
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});
