import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AppTextInput from '@/components/AppTextInput';
import { Colors } from '@/constants/colors';
import { parseWholeNumber, stepValue } from '@/utils/profileLimits';

interface Props {
  testID: string;
  /** Lo que hay escrito (puede estar vacío mientras se edita). */
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
}

// Campo numérico con dos botones pegados al borde derecho (subir y bajar) que no se pasan de `min` ni de `max`.
// También se puede escribir el número a mano.
export default function NumberStepper({ testID, value, onChange, min, max }: Props) {
  const { t } = useTranslation();
  const current = parseWholeNumber(value);
  const atMax = current !== null && current >= max;
  const atMin = current !== null && current <= min;

  return (
    <View style={styles.box}>
      <AppTextInput
        testID={testID}
        style={styles.input}
        value={value}
        onChangeText={text => onChange(text.replace(/\D/g, '').slice(0, String(max).length))}
        keyboardType="numeric"
        returnKeyType="done"
        maxLength={String(max).length}
      />
      <View style={styles.buttons}>
        <TouchableOpacity
          testID={`${testID}-up`}
          accessibilityLabel={t('profile.increase')}
          disabled={atMax}
          style={[styles.button, styles.buttonTop, atMax && styles.buttonDisabled]}
          onPress={() => onChange(String(stepValue(value, 1, min, max)))}
        >
          <Ionicons name="chevron-up" size={16} color={atMax ? Colors.placeholder : Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`${testID}-down`}
          accessibilityLabel={t('profile.decrease')}
          disabled={atMin}
          style={[styles.button, atMin && styles.buttonDisabled]}
          onPress={() => onChange(String(stepValue(value, -1, min, max)))}
        >
          <Ionicons name="chevron-down" size={16} color={atMin ? Colors.placeholder : Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    width: 110,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  buttons: {
    width: 36,
    borderLeftWidth: 1,
    borderLeftColor: Colors.inputBorder,
  },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  buttonTop: { borderBottomWidth: 1, borderBottomColor: Colors.inputBorder },
  buttonDisabled: { backgroundColor: '#f0f0f0' },
});
