import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { productService } from '@/services/productService';
import { ProductCreate } from '@/types/product';
import ProductFormFields from '@/components/ProductFormFields';

const EMPTY_FORM = (): Partial<ProductCreate> => ({});

export default function CargarScreen() {
  const { t } = useTranslation();
  const [form, setForm] = useState<Partial<ProductCreate>>(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!form.nombre?.trim()) return t('product.validationNombre');
    if (!form.categoria?.trim()) return t('product.validationCategoria');
    if (form.stock === undefined || isNaN(form.stock)) return t('product.validationStock');
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await productService.createProduct(form as ProductCreate);
      setSuccess(true);
    } catch {
      setError(t('product.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleLoadAnother = () => {
    setForm(EMPTY_FORM());
    setSuccess(false);
    setError(null);
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.primary} />
        <Text style={styles.successTitle}>{t('product.successTitle')}</Text>
        <Text style={styles.successMsg}>{t('product.successMsg')}</Text>
        <TouchableOpacity
          style={styles.submitBtn}
          onPress={() => router.replace('/(tabs)/inventario')}
        >
          <Text style={styles.submitBtnText}>{t('product.goToInventory')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleLoadAnother}>
          <Text style={styles.secondaryBtnText}>{t('product.loadAnother')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{t('product.loadTitle')}</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <ProductFormFields form={form} onChange={setForm} />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.6 }]}
          onPress={handleSubmit}
          disabled={saving}
        >
          <Text style={styles.submitBtnText}>
            {saving ? t('inventory.saving') : t('product.saveProduct')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', padding: 16, paddingTop: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.textPrimary },
  container: { flex: 1, backgroundColor: '#f2f3f6' },
  content: { padding: 16, paddingBottom: 40 },
  errorText: { color: Colors.error, fontSize: 13, marginTop: 8 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  secondaryBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondaryBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
    backgroundColor: '#f2f3f6',
  },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary },
  successMsg: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
