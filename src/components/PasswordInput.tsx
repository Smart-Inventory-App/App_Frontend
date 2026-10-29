import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleProp, StyleSheet, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import { Colors } from '../constants/colors';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  /** Estilo del contenedor (por ejemplo el margen inferior); `style` va al campo. */
  containerStyle?: StyleProp<ViewStyle>;
  /** testID del botón del ojo. */
  toggleTestID?: string;
}

// Campo de contraseña con el botón del ojo a la derecha para mostrarla u ocultarla (el mismo del login).
export default function PasswordInput({ style, containerStyle, toggleTestID = 'toggle-password', ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.wrapper, containerStyle]}>
      <AppTextInput {...rest} style={[style, styles.input]} secureTextEntry={!visible} />
      <TouchableOpacity
        testID={toggleTestID}
        style={styles.eyeButton}
        onPress={() => setVisible(v => !v)}
        accessibilityRole="button"
        accessibilityState={{ checked: visible }}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={20} color={Colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', position: 'relative', marginBottom: 12 },
  // El margen lo pone el contenedor; el espacio a la derecha evita que el texto quede debajo del ojo
  input: { paddingRight: 46, marginBottom: 0 },
  eyeButton: { position: 'absolute', right: 12, top: 14 },
});
