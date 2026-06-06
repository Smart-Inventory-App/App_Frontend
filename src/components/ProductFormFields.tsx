import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { ProductCreate } from '@/types/product';

interface Props {
  form: Partial<ProductCreate>;
  onChange: (form: Partial<ProductCreate>) => void;
}

export default function ProductFormFields({ form, onChange }: Props) {
  const { t } = useTranslation();
  const set = (key: keyof ProductCreate, value: string | number | undefined) =>
    onChange({ ...form, [key]: value });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('product.nombre')} *</Text>
      <TextInput
        style={styles.input}
        placeholder={t('product.nombrePlaceholder')}
        placeholderTextColor={Colors.placeholder}
        value={form.nombre ?? ''}
        onChangeText={v => set('nombre', v)}
      />

      <Text style={styles.label}>{t('product.categoria')} *</Text>
      <TextInput
        style={styles.input}
        placeholder={t('product.categoriaPlaceholder')}
        placeholderTextColor={Colors.placeholder}
        value={form.categoria ?? ''}
        onChangeText={v => set('categoria', v)}
      />

      <Text style={styles.label}>{t('product.stock')} *</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={Colors.placeholder}
        keyboardType="numeric"
        value={form.stock !== undefined ? String(form.stock) : ''}
        onChangeText={v => set('stock', v === '' ? undefined : parseInt(v, 10))}
      />

      <Text style={styles.label}>{t('product.marca')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('product.optional')}
        placeholderTextColor={Colors.placeholder}
        value={form.marca ?? ''}
        onChangeText={v => set('marca', v || undefined)}
      />

      <Text style={styles.label}>{t('product.vencimiento')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('product.vencimientoPlaceholder')}
        placeholderTextColor={Colors.placeholder}
        value={form.vencimiento ?? ''}
        onChangeText={v => set('vencimiento', v || undefined)}
      />

      <Text style={styles.label}>{t('product.descripcion')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        placeholder={t('product.optional')}
        placeholderTextColor={Colors.placeholder}
        multiline
        numberOfLines={3}
        value={form.descripcion ?? ''}
        onChangeText={v => set('descripcion', v || undefined)}
      />

      <Text style={styles.label}>{t('product.imagen')}</Text>
      <TouchableOpacity style={styles.imageBtn} disabled>
        <Ionicons name="image-outline" size={20} color={Colors.disabled} />
        <Text style={styles.imageBtnText}>{t('product.imagenProximamente')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#fafafa',
    marginTop: 4,
  },
  multiline: { textAlignVertical: 'top', height: 72 },
  imageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  imageBtnText: { fontSize: 14, color: Colors.disabled },
});
