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
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { authService } from '../../src/services/authService';
import { getAuthError } from '../../src/utils/authError';
import { setFlashMessage } from '../../src/utils/flashMessage';

type RuleState = 'valid' | 'invalid' | 'pending';
type EmailStatus = 'idle' | 'checking' | 'available' | 'taken';

const EMAIL_FORMAT = /^\S+@\S+\.\S+$/;

function RuleRow({ state, label }: { state: RuleState; label: string }) {
  const icon = state === 'valid' ? '✓' : state === 'invalid' ? '✗' : '○';
  const iconColor = state === 'valid' ? Colors.valid : state === 'invalid' ? Colors.error : Colors.textSecondary;
  const labelColor = state === 'invalid' ? Colors.error : Colors.textSecondary;
  return (
    <View style={styles.ruleRow}>
      <Text style={[styles.ruleIcon, { color: iconColor }]}>{icon}</Text>
      <Text style={[styles.ruleLabel, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { key: 'minLength', test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'numberOrSpecial', test: (pw: string) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
  ];
  const emailTaken = emailStatus === 'taken';
  const passwordsMatch = password.length > 0 && password === repeat;
  const emailRuleState: RuleState =
    emailStatus === 'available' ? 'valid' : emailStatus === 'taken' ? 'invalid' : 'pending';
  const passwordRuleState = (ok: boolean): RuleState =>
    password.length === 0 ? 'pending' : ok ? 'valid' : 'invalid';
  const matchRuleState: RuleState =
    password.length === 0 && repeat.length === 0 ? 'pending' : passwordsMatch ? 'valid' : 'invalid';

  useEffect(() => {
    if (!EMAIL_FORMAT.test(email.trim())) { setEmailStatus('idle'); return; }
    let cancelled = false;
    setEmailStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const exists = await authService.checkEmail(email.trim());
        if (!cancelled) setEmailStatus(exists ? 'taken' : 'available');
      } catch {
        if (!cancelled) setEmailStatus('idle');
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [email]);

  const allValid = rules.every((r) => r.test(password)) && !emailTaken && passwordsMatch;

  const handleRegister = async () => {
    if (!allValid) return;
    setLoading(true);
    setError(null);
    try {
      await register(email.trim(), password);
      setFlashMessage('register.accountCreated');
      router.replace('/(auth)/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'auth.email_already_registered') {
        setEmailStatus('taken');
      } else if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        setError(t('errors.network'));
      } else {
        setError(getAuthError(detail, t));
      }
    } finally {
      setLoading(false);
    }
  };

  // Vuelve al login inicial (paso del email): limpia el stack y recrea el login desde cero.
  const handleBackToLogin = () => {
    router.dismissAll();
    router.replace('/(auth)/login');
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

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>{t('register.emailLabel')}</Text>
          {emailTaken && <Text style={styles.takenBadge}>{t('register.emailTaken')}</Text>}
        </View>
        <TextInput
          style={[styles.input, emailTaken && styles.inputError]}
          placeholder="email@example.com"
          placeholderTextColor={Colors.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.emailRule}>
          <RuleRow state={emailRuleState} label={t('register.rules.emailAvailable')} />
        </View>

        <Text style={styles.label}>{t('register.passwordLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>{t('register.repeatPasswordLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
        />

        <View style={styles.rulesContainer}>
          {rules.map((rule) => (
            <RuleRow
              key={rule.key}
              state={passwordRuleState(rule.test(password))}
              label={t(`register.rules.${rule.key}` as any)}
            />
          ))}
          <RuleRow state={matchRuleState} label={t('register.rules.passwordsMatch')} />
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (!allValid || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!allValid || loading}
        >
          <Text style={styles.buttonText}>{loading ? t('register.creating') : t('register.createAccount')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLogin}>
          <Text style={styles.backToLoginText}>{t('register.backToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 12 },
  titleSmart: { fontSize: 32, fontWeight: '800', color: Colors.primary, lineHeight: 36 },
  titleInventory: { fontSize: 32, fontWeight: '800', color: Colors.primaryDark, marginBottom: 28 },
  fieldWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 },
  label: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500', marginBottom: 4, alignSelf: 'flex-start' },
  takenBadge: { fontSize: 12, color: Colors.error, fontWeight: '600' },
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
  emailRule: { width: '100%', marginTop: -6, marginBottom: 12 },
  rulesContainer: { width: '100%', marginBottom: 16 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ruleIcon: { fontSize: 14, marginRight: 6, fontWeight: '700' },
  ruleLabel: { fontSize: 13 },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { backgroundColor: Colors.disabled },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  backToLogin: { marginTop: 16 },
  // Mismo formato que el link "Olvidé mi contraseña" del login
  backToLoginText: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  errorText: { color: Colors.error, fontSize: 13, alignSelf: 'flex-start', marginBottom: 8 },
});
