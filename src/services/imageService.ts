import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import { getAuthToken } from './api';
import { appendImage } from '../utils/formData';

const IMAGE_STORAGE_URL = process.env.EXPO_PUBLIC_IMAGE_STORAGE_URL;

async function uploadAsset(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const formData = new FormData();
  await appendImage(
    formData,
    'file',
    { uri: asset.uri, name: asset.fileName, type: asset.mimeType },
    'product.jpg',
  );
  formData.append('folder', 'tpp/products');

  const token = getAuthToken();
  const { data } = await axios.post<{ url: string }>(
    `${IMAGE_STORAGE_URL}/storage/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  return data.url;
}

export async function pickFromGallery(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para acceder a la galería.');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return uploadAsset(result.assets[0]);
}

export async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') throw new Error('Se necesita permiso para usar la cámara.');

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled) return null;
  return uploadAsset(result.assets[0]);
}
