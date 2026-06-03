import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { changeLanguage, type Language } from '../../src/i18n';

export default function PerfilScreen() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const toggleLanguage = async () => {
    const next: Language = i18n.language === 'es' ? 'en' : 'es';
    await changeLanguage(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.welcome')}</Text>

      <TouchableOpacity style={styles.langButton} onPress={toggleLanguage}>
        <Text style={styles.langText}>
          {t('profile.language')}: {i18n.language === 'es' ? '🇦🇷 Español' : '🇺🇸 English'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: Colors.background },
  title: { fontSize: 22, fontWeight: '700', color: Colors.primaryDark, textAlign: 'center', paddingHorizontal: 32 },
  langButton: { borderWidth: 1, borderColor: Colors.inputBorder, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.white },
  langText: { fontSize: 15, color: Colors.textPrimary },
  button: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 8 },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
});
