import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../src/constants/colors';
import { useAuth } from '../../src/context/AuthContext';

type Step = 'email' | 'password';

export default function LoginScreen() {
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    } catch {
      setError('Contraseña o Usuario incorrecto');
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
              placeholder="Email@example.com"
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
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Crear una cuenta</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.socialButton} onPress={() => Alert.alert('Próximamente', 'Login con Google')}>
              <Text style={styles.socialText}>🇬 Continuar con Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton} onPress={() => Alert.alert('Próximamente', 'Login con Apple')}>
              <Text style={styles.socialText}> Continuar con Apple</Text>
            </TouchableOpacity>

            <Text style={styles.terms}>
              Al hacer clic en continuar, aceptas nuestros{' '}
              <Text style={styles.termsLink}>Términos de Servicio</Text>
              {' '}y nuestra{' '}
              <Text style={styles.termsLink}>Política de Privacidad</Text>
            </Text>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, !!error && styles.inputError]}
              placeholder="Contraseña"
              placeholderTextColor={Colors.placeholder}
              value={password}
              onChangeText={(v) => { setPassword(v); setError(''); }}
              secureTextEntry
              autoFocus
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Ingresando...' : 'Continuar'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
              <Text style={styles.forgotLink}>Olvide mi contraseña</Text>
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
  link: { color: Colors.primary, fontSize: 15, marginBottom: 24 },
  forgotLink: { color: Colors.textSecondary, fontSize: 14, marginTop: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.divider },
  dividerText: { marginHorizontal: 12, color: Colors.textSecondary, fontSize: 13 },
  socialButton: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: Colors.socialBorder,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: Colors.white,
  },
  socialText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  terms: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  termsLink: { color: Colors.primary },
});
