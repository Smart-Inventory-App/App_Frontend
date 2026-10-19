import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { authService } from '../../src/services/authService';
import { getAuthError } from '../../src/utils/authError';
import { setFlashMessage } from '../../src/utils/flashMessage';

type RuleState = 'valid' | 'invalid' | 'pending';
type DifferenceStatus = 'idle' | 'checking' | 'different' | 'same';

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

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { reset_token } = useLocalSearchParams<{ reset_token: string }>();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [differenceStatus, setDifferenceStatus] = useState<DifferenceStatus>('idle');

  const rules = [
    { key: 'minLength', test: (pw: string) => pw.length >= 8 },
    { key: 'uppercase', test: (pw: string) => /[A-Z]/.test(pw) },
    { key: 'lowercase', test: (pw: string) => /[a-z]/.test(pw) },
    { key: 'numberOrSpecial', test: (pw: string) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
  ];

  // Compara contra la contraseña actual en el servidor (acá no se conoce), con una pausa al tipear.
  useEffect(() => {
    if (!password) { setDifferenceStatus('idle'); return; }
    let cancelled = false;
    setDifferenceStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const different = await authService.checkNewPassword(reset_token, password);
        if (!cancelled) setDifferenceStatus(different ? 'different' : 'same');
      } catch {
        if (!cancelled) setDifferenceStatus('idle');
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [password, reset_token]);

  const differenceRuleState: RuleState =
    differenceStatus === 'different' ? 'valid' : differenceStatus === 'same' ? 'invalid' : 'pending';

  const passwordsMatch = password.length > 0 && password === repeat;
  const matchRuleState: RuleState =
    password.length === 0 && repeat.length === 0 ? 'pending' : passwordsMatch ? 'valid' : 'invalid';

  const allValid =
    rules.every((r) => r.test(password)) && passwordsMatch && differenceStatus !== 'same';

  const handleChange = async () => {
    if (!allValid) return;
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(reset_token, password);
      setFlashMessage('changePassword.success');
      router.replace('/(auth)/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'auth.password_same_as_current') {
        setDifferenceStatus('same');
      } else {
        setError(getAuthError(detail, t, t('changePassword.genericError')));
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
      <KeyboardAwareScrollView contentContainerStyle={styles.container}>
        <Image source={require('../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.titleSmart}>Smart</Text>
        <Text style={styles.titleInventory}>Inventory</Text>

        <Text style={styles.label}>{t('changePassword.newPassword')}</Text>
        <AppTextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          secureTextEntry
        />

        <Text style={styles.label}>{t('changePassword.repeatPassword')}</Text>
        <AppTextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={repeat}
          onChangeText={(v) => { setRepeat(v); setError(''); }}
          secureTextEntry
        />

        <View style={styles.rulesContainer}>
          <RuleRow state={differenceRuleState} label={t('changePassword.rules.differentFromCurrent')} />
          {rules.map((rule) => (
            <RuleRow
              key={rule.key}
              state={rule.test(password) ? 'valid' : 'invalid'}
              label={t(`changePassword.rules.${rule.key}` as any)}
            />
          ))}
          <RuleRow state={matchRuleState} label={t('changePassword.rules.passwordsMatch')} />
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (!allValid || loading) && styles.buttonDisabled]}
          onPress={handleChange}
          disabled={!allValid || loading}
        >
          <Text style={styles.buttonText}>{loading ? t('changePassword.changing') : t('changePassword.changePassword')}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, paddingBottom: 40 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 12 },
  titleSmart: { fontSize: 32, fontWeight: '800', color: Colors.primary, lineHeight: 36 },
  titleInventory: { fontSize: 32, fontWeight: '800', color: Colors.primaryDark, marginBottom: 28 },
  label: { fontSize: 13, color: Colors.textPrimary, fontWeight: '500', marginBottom: 4, alignSelf: 'flex-start' },
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
  rulesContainer: { width: '100%', marginBottom: 12 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  ruleIcon: { fontSize: 14, marginRight: 6, fontWeight: '700' },
  ruleLabel: { fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 10, alignSelf: 'flex-start' },
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
});
