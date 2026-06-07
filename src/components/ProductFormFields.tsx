import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { ProductCreate } from '@/types/product';

interface Props {
  form: Partial<ProductCreate>;
  onChange: (form: Partial<ProductCreate>) => void;
  ubicacionOptions?: string[];
  onAddUbicacion?: (loc: string) => void;
}

export default function ProductFormFields({ form, onChange, ubicacionOptions = [], onAddUbicacion }: Props) {
  const { t } = useTranslation();
  const [showNewLoc, setShowNewLoc] = useState(false);
  const [newLoc, setNewLoc] = useState('');

  const set = (key: keyof ProductCreate, value: string | number | undefined) =>
    onChange({ ...form, [key]: value });

  const handleSelectUbicacion = (loc: string) => {
    set('ubicacion', form.ubicacion === loc ? undefined : loc);
  };

  const handleConfirmNewLoc = () => {
    const trimmed = newLoc.trim();
    if (!trimmed) {
      setShowNewLoc(false);
      return;
    }
    set('ubicacion', trimmed);
    onAddUbicacion?.(trimmed);
    setNewLoc('');
    setShowNewLoc(false);
  };

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

      <Text style={styles.label}>{t('product.ubicacion')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {ubicacionOptions.map(loc => (
          <TouchableOpacity
            key={loc}
            style={[styles.chip, form.ubicacion === loc && styles.chipActive]}
            onPress={() => handleSelectUbicacion(loc)}
          >
            <Text style={[styles.chipText, form.ubicacion === loc && styles.chipTextActive]}>
              {loc}
            </Text>
          </TouchableOpacity>
        ))}
        {!showNewLoc && (
          <TouchableOpacity style={styles.chipAdd} onPress={() => setShowNewLoc(true)}>
            <Ionicons name="add" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {showNewLoc && (
        <View style={styles.newLocRow}>
          <TextInput
            style={[styles.input, styles.newLocInput]}
            placeholder={t('product.ubicacionPlaceholder')}
            placeholderTextColor={Colors.placeholder}
            value={newLoc}
            onChangeText={setNewLoc}
            autoFocus
            onSubmitEditing={handleConfirmNewLoc}
          />
          <TouchableOpacity style={styles.newLocConfirm} onPress={handleConfirmNewLoc}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newLocCancel} onPress={() => { setShowNewLoc(false); setNewLoc(''); }}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {form.ubicacion && !ubicacionOptions.includes(form.ubicacion) && !showNewLoc && (
        <Text style={styles.selectedLoc}>
          <Ionicons name="location-outline" size={12} /> {form.ubicacion}
        </Text>
      )}

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
  chipsScroll: { flexGrow: 0, marginTop: 6 },
  chipsContent: { gap: 8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  chipAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  newLocRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  newLocInput: { flex: 1, marginTop: 0 },
  newLocConfirm: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newLocCancel: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  selectedLoc: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
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
