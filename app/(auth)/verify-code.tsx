import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import KeyboardAwareScrollView from '@/components/KeyboardAwareScrollView';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../src/constants/colors';
import { authService } from '../../src/services/authService';

const CODE_LENGTH = 6;

export default function VerifyCodeScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleDigit = (value: string, index: number) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const code = digits.join('');

  const handleVerify = async () => {
    if (code.length < CODE_LENGTH) return;
    setLoading(true);
    setError('');
    try {
      const reset_token = await authService.verifyCode(email, code);
      router.push({ pathname: '/(auth)/change-password', params: { reset_token } });
    } catch {
      setError(t('verifyCode.invalidCode'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.forgotPassword(email);
      setDigits(Array(CODE_LENGTH).fill(''));
      setError('');
      inputRefs.current[0]?.focus();
    } catch { /* ignore */ } finally {
      setResending(false);
    }
  };

  // Vuelve al login inicial (paso del email): limpia el stack de recuperación y recrea el login desde cero.
  const handleBackToLogin = () => {
    router.dismissAll();
    router.replace('/(auth)/login');
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

        <Text style={styles.description}>{t('verifyCode.description')}</Text>

        <View style={styles.codeRow}>
          {digits.map((d, i) => (
            <AppTextInput
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              style={[styles.digitBox, !!error && styles.digitBoxError]}
              value={d}
              onChangeText={(v) => handleDigit(v, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (code.length < CODE_LENGTH || loading) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={code.length < CODE_LENGTH || loading}
        >
          <Text style={styles.buttonText}>{loading ? t('verifyCode.verifying') : t('verifyCode.recoverAccount')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={resending}>
          <Text style={styles.resendLink}>{resending ? t('verifyCode.resending') : t('verifyCode.resendCode')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleBackToLogin} style={styles.backToLogin}>
          <Text style={styles.backToLoginText}>{t('verifyCode.backToLogin')}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 80, paddingBottom: 40 },
  logo: { width: 100, height: 100, borderRadius: 20, marginBottom: 12 },
  titleSmart: { fontSize: 32, fontWeight: '800', color: Colors.primary, lineHeight: 36 },
  titleInventory: { fontSize: 32, fontWeight: '800', color: Colors.primaryDark, marginBottom: 24 },
  description: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  codeRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  digitBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  digitBoxError: { borderColor: Colors.inputBorderError },
  errorText: { color: Colors.error, fontSize: 13, marginBottom: 12 },
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
  resendLink: { color: Colors.primary, fontSize: 14, fontWeight: '500' },
  backToLogin: { marginTop: 16 },
  // Mismo formato que el link "Olvidé mi contraseña" del login
  backToLoginText: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
});
