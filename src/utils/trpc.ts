import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from 'app_backend/app/routers';

/**
 * Create tRPC React client
 * This allows type-safe communication with the backend
 * 
 * Usage:
 *   const mutation = trpc.auth.register.useMutation()
 *   const query = trpc.user.me.useQuery()
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Export router type for use in components
 */
export type { AppRouter } from 'app_backend/app/routers';
