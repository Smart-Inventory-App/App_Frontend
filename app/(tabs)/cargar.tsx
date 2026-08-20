import React, { useCallback, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
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
  const [ubicacionOptions, setUbicacionOptions] = useState<string[]>([]);
  const [categoriaOptions, setCategoriaOptions] = useState<string[]>([]);
  const [marcaOptions, setMarcaOptions] = useState<string[]>([]);
  const [merged, setMerged] = useState(false);

  const applyDefaults = useCallback(() => {
    productService.getDefaults()
      .then(({ last_categoria, last_ubicacion }) => {
        setForm(prev => ({
          ...prev,
          categoria: prev.categoria ?? last_categoria ?? undefined,
          ubicacion: prev.ubicacion ?? last_ubicacion ?? undefined,
        }));
      })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    productService.getFilterOptions()
      .then(({ categorias, ubicaciones, marcas }) => {
        setCategoriaOptions(categorias);
        setUbicacionOptions(ubicaciones);
        setMarcaOptions(marcas);
      })
      .catch(() => {});
    applyDefaults();
  }, [applyDefaults]));

  const validate = (): string | null => {
    if (!form.nombre?.trim()) return t('product.validationNombre');
    if (!form.categoria?.trim()) return t('product.validationCategoria');
    if (form.stock === undefined || isNaN(form.stock) || form.stock <= 0) return t('product.validationStock');
    if (form.vencimiento) {
      const d = new Date(form.vencimiento);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.vencimiento) || isNaN(d.getTime())) {
        return t('product.validationVencimiento');
      }
    }
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
      const created = await productService.createProduct(form as ProductCreate);
      setMerged(Boolean(created.merged));
      setSuccess(true);
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg ?? JSON.stringify(e)).join('\n'));
      } else {
        const msg = (err as any)?.message;
        setError(msg ?? t('product.saveError'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLoadAnother = () => {
    setForm(EMPTY_FORM());
    setSuccess(false);
    setMerged(false);
    setError(null);
    applyDefaults();
  };

  const handleAddUbicacion = (loc: string) => {
    setUbicacionOptions(prev => [...new Set([...prev, loc])]);
  };

  const handleAddCategoria = (cat: string) => {
    setCategoriaOptions(prev => [...new Set([...prev, cat])]);
  };

  const handleAddMarca = (marca: string) => {
    setMarcaOptions(prev => [...new Set([...prev, marca])]);
  };

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Ionicons name="checkmark-circle" size={72} color={Colors.primary} />
        <Text style={styles.successTitle}>{t('product.successTitle')}</Text>
        <Text style={styles.successMsg}>
          {merged ? t('product.successMsgMerged') : t('product.successMsg')}
        </Text>
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
        <ProductFormFields
          form={form}
          onChange={setForm}
          ubicacionOptions={ubicacionOptions}
          onAddUbicacion={handleAddUbicacion}
          categoriaOptions={categoriaOptions}
          onAddCategoria={handleAddCategoria}
          marcaOptions={marcaOptions}
          onAddMarca={handleAddMarca}
          suggestNombre={productService.suggestProducts}
        />

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
