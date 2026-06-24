import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import axios from 'axios';
import { getAuthToken } from './api';

const IMAGE_STORAGE_URL = process.env.EXPO_PUBLIC_IMAGE_STORAGE_URL;

async function uploadAsset(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  const name = asset.fileName ?? 'product.jpg';
  const type = asset.mimeType ?? 'image/jpeg';

  const formData = new FormData();

  if (Platform.OS === 'web') {
    // En web hay que adjuntar un Blob real; el objeto {uri,name,type} solo funciona en nativo.
    const blob = await (await fetch(asset.uri)).blob();
    formData.append('file', blob);
  } else {
    formData.append('file', {
      uri: asset.uri,
      name,
      type,
    } as unknown as Blob);
  }
  formData.append('folder', 'bazaar/products');

  const token = getAuthToken();
  const { data } = await axios.post<{ url: string }>(
    `${IMAGE_STORAGE_URL}/storage/upload`,
    formData,
    {
      headers: {
        // No seteamos Content-Type: el cliente debe generar el boundary del multipart.
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
