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

function RuleRow({ valid, label }: { valid: boolean; label: string }) {
  return (
    <View style={styles.ruleRow}>
      <Text style={[styles.ruleIcon, { color: valid ? Colors.valid : Colors.error }]}>
        {valid ? '✓' : '✗'}
      </Text>
      <Text style={[styles.ruleLabel, { color: valid ? Colors.textSecondary : Colors.error }]}>
        {label}
      </Text>
    </View>
  );
}

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = [
    { key: 'minLength', test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'numberOrSpecial', test: (pw: string) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
    { key: 'emailAvailable', test: (_pw: string) => !emailTaken },
  ];

  useEffect(() => {
    if (!email || !email.includes('@')) { setEmailTaken(false); return; }
    const timer = setTimeout(async () => {
      try {
        const exists = await authService.checkEmail(email.trim());
        setEmailTaken(exists);
      } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(timer);
  }, [email]);

  const allValid = rules.every((r) => r.test(password)) && password === repeat;

  const handleRegister = async () => {
    if (!allValid) return;
    setLoading(true);
    setError(null);
    try {
      await register(email.trim(), password);
      router.replace('/(auth)/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'auth.email_already_registered') {
        setEmailTaken(true);
      } else if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        setError(t('errors.network'));
      } else {
        setError(getAuthError(detail, t));
      }
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

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>{t('register.emailLabel')}</Text>
          {emailTaken && <Text style={styles.takenBadge}>{t('register.emailTaken')}</Text>}
        </View>
        <TextInput
          style={[styles.input, emailTaken && styles.inputError]}
          placeholder="email@example.com"
          placeholderTextColor={Colors.placeholder}
          value={email}
          onChangeText={(v) => { setEmail(v); setEmailTaken(false); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t('register.passwordLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={password}
          onChangeText={(v) => { setPassword(v); setShowRules(true); }}
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

        {(showRules || password.length > 0) && (
          <View style={styles.rulesContainer}>
            {rules.map((rule) => (
              <RuleRow
                key={rule.key}
                valid={rule.test(password)}
                label={t(`register.rules.${rule.key}` as any)}
              />
            ))}
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (!allValid || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!allValid || loading}
        >
          <Text style={styles.buttonText}>{loading ? t('register.creating') : t('register.createAccount')}</Text>
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
  errorText: { color: Colors.error, fontSize: 13, alignSelf: 'flex-start', marginBottom: 8 },
});
