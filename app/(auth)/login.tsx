import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

type Step = 'email' | 'password';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_ENABLED = !!(GOOGLE_ANDROID_CLIENT_ID && GOOGLE_WEB_CLIENT_ID);

// Separated component so the hook only runs when client IDs are configured
function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);

  const [, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID!,
    webClientId: GOOGLE_WEB_CLIENT_ID!,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const token = response.authentication?.accessToken;
      if (token) {
        setLoading(true);
        loginWithGoogle(token)
          .then(() => router.replace('/(app)/'))
          .catch((err: any) => {
            const detail = err?.response?.data?.detail;
            onError(typeof detail === 'string' ? detail : 'Error al iniciar sesión con Google');
          })
          .finally(() => setLoading(false));
      }
    } else if (response?.type === 'error') {
      onError('Error al conectar con Google');
    }
  }, [response]);

  return (
    <TouchableOpacity
      style={[styles.googleButton, loading && styles.buttonDisabled]}
      onPress={() => promptAsync()}
      disabled={loading}
    >
      <Ionicons name="logo-google" size={18} color={loading ? Colors.textSecondary : '#DB4437'} style={styles.googleIcon} />
      <Text style={styles.googleButtonText}>
        {loading ? 'Conectando...' : 'Continuar con Google'}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailContinue = () => {
    if (!email.trim()) return;
    setError('');
    setStep('password');
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)/');
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : t('login.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.titleSmart}>Smart</Text>
        <Text style={styles.titleInventory}>Inventory</Text>

        {step === 'email' ? (
          <>
            <TextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={Colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.button, !email.trim() && styles.buttonDisabled]}
              onPress={handleEmailContinue}
              disabled={!email.trim()}
            >
              <Text style={styles.buttonText}>{t('common.continue')}</Text>
            </TouchableOpacity>

            {GOOGLE_ENABLED && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>o</Text>
                  <View style={styles.dividerLine} />
                </View>
                <GoogleButton onError={setError} />
              </>
            )}

            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>{t('login.createAccount')}</Text>
            </TouchableOpacity>

            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backRow} onPress={() => { setStep('email'); setError(''); setPassword(''); }}>
              <Ionicons name="arrow-back" size={18} color={Colors.primary} />
              <Text style={styles.backText}>{email}</Text>
            </TouchableOpacity>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, styles.inputWithIcon, !!error && styles.inputError]}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={Colors.placeholder}
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                secureTextEntry={!showPassword}
                autoFocus
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? t('login.signingIn') : t('common.continue')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotLink}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 40,
  },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 12 },
  titleSmart: { fontSize: 32, fontWeight: '800', color: Colors.primary, lineHeight: 36 },
  titleInventory: { fontSize: 32, fontWeight: '800', color: Colors.primaryDark, marginBottom: 36 },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    marginBottom: 12,
    backgroundColor: Colors.white,
  },
  inputError: { borderColor: Colors.inputBorderError },
  errorText: { color: Colors.error, fontSize: 13, alignSelf: 'flex-start', marginBottom: 8, marginTop: -4 },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { backgroundColor: Colors.disabled },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.inputBorder },
  dividerText: { color: Colors.textSecondary, fontSize: 13, marginHorizontal: 12 },
  googleButton: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  googleIcon: { marginRight: 10 },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  link: { color: Colors.primary, fontSize: 15, marginBottom: 24 },
  forgotLink: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 20, gap: 6 },
  backText: { color: Colors.primary, fontSize: 14 },
  inputWrapper: { width: '100%', position: 'relative', marginBottom: 12 },
  inputWithIcon: { paddingRight: 46, marginBottom: 0 },
  eyeButton: { position: 'absolute', right: 12, top: 14 },
});
