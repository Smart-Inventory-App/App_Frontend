import { router } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import ConfirmModal from '../../src/components/ConfirmModal';
import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { authService } from '../../src/services/authService';
import { GOOGLE_ENABLED, configureGoogleSignIn } from '../../src/services/googleSignIn';
import TopBanner from '../../src/components/TopBanner';
import { getAuthError } from '../../src/utils/authError';
import { clearFlashMessage, peekFlashMessage } from '../../src/utils/flashMessage';

type Step = 'email' | 'password';

configureGoogleSignIn();

function GoogleButton({ onError }: { onError: (msg: string) => void }) {
  const { loginWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      // Si el usuario cierra la ventana de Google, la librería lo informa sin lanzar un error
      if (response?.type === 'cancelled') return;
      // El servidor verifica este idToken y comprueba que fue emitido para nuestra app (el cliente Web)
      const signedIn = response as unknown as { data?: { idToken?: string | null } } | undefined;
      const idToken = signedIn?.data?.idToken ?? (await GoogleSignin.getTokens()).idToken;
      if (!idToken) throw new Error('No id token');
      await loginWithGoogle(idToken);
      router.replace('/(app)/');
    } catch (err: any) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
      }
      const detail = err?.response?.data?.detail;
      onError(getAuthError(detail, t, t('login.googleError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.googleButton, loading && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={loading}
    >
      <Ionicons name="logo-google" size={18} color={loading ? Colors.textSecondary : '#DB4437'} style={styles.googleIcon} />
      <Text style={styles.googleButtonText}>
        {loading ? t('login.connecting') : t('login.continueWithGoogle')}
      </Text>
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(peekFlashMessage);
  const [checkingEmail, setCheckingEmail] = useState(false);
  // El email es de una cuenta creada con Google que todavía no tiene contraseña
  const [googleOnly, setGoogleOnly] = useState(false);

  const dismissFlash = () => {
    clearFlashMessage();
    setFlashKey(null);
  };

  const handleEmailContinue = async () => {
    if (!email.trim() || checkingEmail) return;
    setError('');
    setCheckingEmail(true);
    try {
      const status = await authService.getEmailStatus(email.trim());
      // Una cuenta de Google sin contraseña no puede entrar con contraseña: se le explica qué hacer
      if (status.exists && status.password_set === false) {
        setGoogleOnly(true);
        return;
      }
    } catch {
      // Si no se pudo consultar, se sigue como siempre: el login dirá si algo está mal
    } finally {
      setCheckingEmail(false);
    }
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
      setError(getAuthError(detail, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.titleSmart}>Smart</Text>
        <Text style={styles.titleInventory}>Inventory</Text>

        {step === 'email' ? (
          <>
            <AppTextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={Colors.placeholder}
              value={email}
              onChangeText={(v) => { setEmail(v); setGoogleOnly(false); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.button, (!email.trim() || checkingEmail) && styles.buttonDisabled]}
              onPress={handleEmailContinue}
              disabled={!email.trim() || checkingEmail}
            >
              <Text style={styles.buttonText}>{t('common.continue')}</Text>
            </TouchableOpacity>

            {GOOGLE_ENABLED && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t('login.or')}</Text>
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
              <AppTextInput
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

            <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } })}>
              <Text style={styles.forgotLink}>{t('login.forgotPassword')}</Text>
            </TouchableOpacity>
          </>
        )}
      </KeyboardAwareScrollView>
      {/* Cuenta creada con Google y sin contraseña: pop up con las dos salidas */}
      <ConfirmModal
        visible={googleOnly}
        message={t('login.googleAccountNotice')}
        confirmLabel={t('login.createPassword')}
        cancelLabel={t('login.backToLogin')}
        confirmTone="primary"
        onConfirm={() => {
          setGoogleOnly(false);
          router.push({ pathname: '/(auth)/forgot-password', params: { email: email.trim() } });
        }}
        onCancel={() => setGoogleOnly(false)}
      />
      {!!flashKey && <TopBanner message={t(flashKey as any)} onDismiss={dismissFlash} autoDismissMs={5000} />}
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
  logo: { width: 100, height: 100, resizeMode: 'contain', marginBottom: 12 },
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
