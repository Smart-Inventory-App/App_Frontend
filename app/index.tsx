import { Redirect } from 'expo-router';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Colors } from '../src/constants/colors';
import { useAuth } from '../src/context/AuthContext';
import { useEffect } from 'react';
import { initNotifications } from '@/services/firebaseService';

export default function RootIndex() {
  const { isAuthenticated, isLoading } = useAuth();
  useEffect(() => {
    initNotifications();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/(app)/' : '/(auth)/login'} />;
}