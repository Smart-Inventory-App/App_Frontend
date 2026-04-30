import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from '@/utils/trpc';

/**
 * Composable auth hook using tRPC
 * Type-safe authentication with the backend
 */
export function useAuth() {
  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const getMeQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!AsyncStorage.getItem('access_token'),
  });

  const register = async (email: string, username: string, password: string) => {
    try {
      const result = await registerMutation.mutateAsync({
        email,
        username,
        password,
      });
      return result;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({
        email,
        password,
      });
      
      // Save token
      if (result.access_token) {
        await AsyncStorage.setItem('access_token', result.access_token);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('access_token');
  };

  return {
    register,
    login,
    logout,
    user: getMeQuery.data,
    isLoading: registerMutation.isPending || loginMutation.isPending || getMeQuery.isLoading,
    error: registerMutation.error || loginMutation.error || getMeQuery.error,
  };
}
