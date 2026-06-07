import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const IMAGE_STORAGE_URL = process.env.EXPO_PUBLIC_IMAGE_STORAGE_URL;

export async function pickAndUploadProductImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Se necesita permiso para acceder a la galería.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;

  const asset = result.assets[0];
  const formData = new FormData();

  formData.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? 'product.jpg',
    type: asset.mimeType ?? 'image/jpeg',
  } as unknown as Blob);
  formData.append('folder', 'bazaar/products');

  const { data } = await axios.post<{ url: string }>(
    `${IMAGE_STORAGE_URL}/storage/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );

  return data.url;
}
