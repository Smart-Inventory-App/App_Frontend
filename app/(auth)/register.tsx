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
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';
import { authService } from '../../src/services/authService';

interface Rule {
  label: string;
  test: (pw: string, repeat: string, emailTaken: boolean) => boolean;
}

const PASSWORD_RULES: Rule[] = [
  { label: 'Mínimo de 8 caracteres', test: (pw) => pw.length >= 8 },
  { label: 'Contiene mayúsculas', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Contiene minúsculas', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Contiene número y/o carácter especial', test: (pw) => /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pw) },
  { label: 'Correo no registrado', test: (_pw, _r, emailTaken) => !emailTaken },
];

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
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [emailTaken, setEmailTaken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  // Debounced email check
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

  const allValid = PASSWORD_RULES.every((r) => r.test(password, repeat, emailTaken))
    && password === repeat;

  const handleRegister = async () => {
    if (!allValid) return;
    setLoading(true);
    try {
      await register(email.trim(), password);
      router.replace('/(auth)/login');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail === 'EMAIL_TAKEN') setEmailTaken(true);
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

        {/* Email */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Email</Text>
          {emailTaken && <Text style={styles.takenBadge}>Mail en uso</Text>}
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

        {/* Password */}
        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={password}
          onChangeText={(v) => { setPassword(v); setShowRules(true); }}
          secureTextEntry
        />

        {/* Repeat */}
        <Text style={styles.label}>Repetir Contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.placeholder}
          value={repeat}
          onChangeText={setRepeat}
          secureTextEntry
        />

        {/* Validation rules */}
        {(showRules || password.length > 0) && (
          <View style={styles.rulesContainer}>
            {PASSWORD_RULES.map((rule) => (
              <RuleRow
                key={rule.label}
                valid={rule.test(password, repeat, emailTaken)}
                label={rule.label}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, (!allValid || loading) && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!allValid || loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Creando cuenta...' : 'Crear Cuenta'}</Text>
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
});
