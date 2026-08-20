import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView,
  Image, ActivityIndicator, Alert, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '@/constants/colors';
import { ProductCreate, ProductSuggestion } from '@/types/product';
import { pickFromGallery, pickFromCamera } from '@/services/imageService';

interface Props {
  form: Partial<ProductCreate>;
  onChange: (form: Partial<ProductCreate>) => void;
  ubicacionOptions?: string[];
  onAddUbicacion?: (loc: string) => void;
  categoriaOptions?: string[];
  onAddCategoria?: (cat: string) => void;
  suggestNombre?: (q: string) => Promise<ProductSuggestion[]>;
}

const normalizeToExisting = (value: string, options: string[]): string => {
  const match = options.find(o => o.toLowerCase() === value.toLowerCase());
  return match ?? value;
};

export default function ProductFormFields({
  form,
  onChange,
  ubicacionOptions = [],
  onAddUbicacion,
  categoriaOptions = [],
  onAddCategoria,
  suggestNombre,
}: Props) {
  const { t } = useTranslation();
  const [showNewLoc, setShowNewLoc] = useState(false);
  const [newLoc, setNewLoc] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [nombreSuggestions, setNombreSuggestions] = useState<ProductSuggestion[]>([]);
  const [nombreFocused, setNombreFocused] = useState(false);

  const set = (key: keyof ProductCreate, value: string | number | undefined) =>
    onChange({ ...form, [key]: value });

  useEffect(() => {
    if (!suggestNombre) return;
    const q = (form.nombre ?? '').trim();
    if (q.length < 2) {
      setNombreSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      suggestNombre(q).then(setNombreSuggestions).catch(() => setNombreSuggestions([]));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.nombre, suggestNombre]);

  const handleSelectSuggestion = (s: ProductSuggestion) => {
    onChange({
      ...form,
      nombre: s.nombre,
      marca: s.marca ?? form.marca,
      categoria: s.categoria,
      ubicacion: s.ubicacion ?? form.ubicacion,
    });
    setNombreSuggestions([]);
  };

  const doUpload = async (picker: () => Promise<string | null>) => {
    setShowImagePicker(false);
    try {
      setUploadingImage(true);
      const url = await picker();
      if (url) set('imagen_url', url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al subir la imagen.';
      Alert.alert('Error', message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSelectUbicacion = (loc: string) => {
    set('ubicacion', form.ubicacion === loc ? undefined : loc);
  };

  const handleConfirmNewLoc = () => {
    const trimmed = newLoc.trim();
    if (!trimmed) { setShowNewLoc(false); return; }
    const value = normalizeToExisting(trimmed, ubicacionOptions);
    set('ubicacion', value);
    onAddUbicacion?.(value);
    setNewLoc('');
    setShowNewLoc(false);
  };

  const handleSelectCategoria = (cat: string) => {
    set('categoria', form.categoria === cat ? undefined : cat);
  };

  const handleConfirmNewCat = () => {
    const trimmed = newCat.trim();
    if (!trimmed) { setShowNewCat(false); return; }
    const value = normalizeToExisting(trimmed, categoriaOptions);
    set('categoria', value);
    onAddCategoria?.(value);
    setNewCat('');
    setShowNewCat(false);
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
        onFocus={() => setNombreFocused(true)}
        onBlur={() => setTimeout(() => setNombreFocused(false), 150)}
        maxLength={20}
      />
      {nombreFocused && nombreSuggestions.length > 0 && (
        <View style={styles.suggestionsBox}>
          {nombreSuggestions.map(s => (
            <TouchableOpacity
              key={s.nombre}
              style={styles.suggestionItem}
              onPress={() => handleSelectSuggestion(s)}
            >
              <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.suggestionText}>{s.nombre}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>{t('product.categoria')} *</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {categoriaOptions.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, form.categoria === cat && styles.chipActive]}
            onPress={() => handleSelectCategoria(cat)}
          >
            <Text style={[styles.chipText, form.categoria === cat && styles.chipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        {!showNewCat && (
          <TouchableOpacity style={styles.chipAdd} onPress={() => setShowNewCat(true)}>
            <Ionicons name="add" size={16} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {showNewCat && (
        <View style={styles.newLocRow}>
          <TextInput
            style={[styles.input, styles.newLocInput]}
            placeholder={t('product.categoriaPlaceholder')}
            placeholderTextColor={Colors.placeholder}
            value={newCat}
            onChangeText={setNewCat}
            autoFocus
            maxLength={20}
            onSubmitEditing={handleConfirmNewCat}
          />
          <TouchableOpacity style={styles.newLocConfirm} onPress={handleConfirmNewCat}>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newLocCancel} onPress={() => { setShowNewCat(false); setNewCat(''); }}>
            <Ionicons name="close" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {form.categoria && !categoriaOptions.includes(form.categoria) && !showNewCat && (
        <Text style={styles.selectedLoc}>{form.categoria}</Text>
      )}

      <Text style={styles.label}>{t('product.stock')} *</Text>
      <TextInput
        style={styles.input}
        placeholder="0"
        placeholderTextColor={Colors.placeholder}
        keyboardType="numeric"
        value={form.stock !== undefined ? String(form.stock) : ''}
        onChangeText={v => {
          const digits = v.replace(/[^0-9]/g, '');
          set('stock', digits === '' ? undefined : parseInt(digits, 10));
        }}
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
        maxLength={400}
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
      {form.imagen_url ? (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: form.imagen_url }} style={styles.imagePreview} resizeMode="cover" />
          <TouchableOpacity style={styles.imageChangeBtn} onPress={() => setShowImagePicker(true)} disabled={uploadingImage}>
            {uploadingImage
              ? <ActivityIndicator size="small" color={Colors.primary} />
              : <><Ionicons name="pencil-outline" size={16} color={Colors.primary} /><Text style={styles.imageChangeBtnText}>{t('product.imagenCambiar')}</Text></>
            }
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.imageBtn} onPress={() => setShowImagePicker(true)} disabled={uploadingImage}>
          {uploadingImage
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <><Ionicons name="image-outline" size={20} color={Colors.primary} /><Text style={styles.imageBtnTextActive}>{t('product.imagenSeleccionar')}</Text></>
          }
        </TouchableOpacity>
      )}

      <Modal visible={showImagePicker} transparent animationType="slide" onRequestClose={() => setShowImagePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowImagePicker(false)}>
          <Pressable style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('product.imagenSeleccionar')}</Text>

            <TouchableOpacity style={styles.modalOption} onPress={() => doUpload(pickFromCamera)}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="camera-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.modalOptionText}>{t('product.imagenCamara')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOption} onPress={() => doUpload(pickFromGallery)}>
              <View style={styles.modalOptionIcon}>
                <Ionicons name="images-outline" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.modalOptionText}>{t('product.imagenGaleria')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowImagePicker(false)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
  suggestionsBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: Colors.inputBorder ?? '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: { fontSize: 14, color: Colors.textPrimary },
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
    borderColor: Colors.primary,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    gap: 8,
    backgroundColor: '#fafafa',
  },
  imageBtnTextActive: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  imagePreviewContainer: { marginTop: 4, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: Colors.inputBorder },
  imagePreview: { width: '100%', height: 180 },
  imageChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  imageChangeBtnText: { fontSize: 13, color: Colors.primary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 36,
    gap: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  modalCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#f2f3f6',
  },
  modalCancelText: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
});
